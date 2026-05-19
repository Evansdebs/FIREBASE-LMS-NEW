const prisma = require('../config/prisma');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');

const logError = (name, error) => {
  try {
    const msg = `[${new Date().toISOString()}] ${name}: ${error.stack || error.message || error}\n`;
    fs.appendFileSync(path.join(__dirname, '../../teacher_error.log'), msg);
    console.error(name, error);
  } catch(e) {}
};

// ─── DASHBOARD ──────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ 
      where: { userId: req.user.id },
      include: {
        _count: { select: { quizzes: true, assignments: true, liveClasses: true } }
      }
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found.' });

    const [courses, pendingSubmissions, upcomingClasses, recentResults] = await Promise.all([
      prisma.course.findMany({
        where: { courseTeachers: { some: { teacherId: teacher.id } } },
        include: { courseClasses: { include: { class: true } }, subject: true, _count: { select: { topics: true, quizzes: true, assignments: true } } },
      }),
      prisma.submission.count({
        where: { assignment: { createdBy: teacher.id }, grade: null },
      }),
      prisma.liveClass.findMany({
        where: { teacherId: teacher.id, scheduleDate: { gte: new Date() } },
        take: 5, orderBy: { scheduleDate: 'asc' },
        include: { class: { include: { _count: { select: { students: true } } } } }
      }),
      prisma.quizAttempt.findMany({
        where: { quiz: { createdBy: teacher.id } },
        take: 10, orderBy: { submittedAt: 'desc' },
        include: { student: { include: { user: { select: { name: true } } } }, quiz: { select: { title: true } } },
      }),
    ]);

    // Get all classIds for this teacher's courses
    const classIds = courses.flatMap(c => c.courseClasses.map(cc => cc.classId));
    const uniqueClassIds = [...new Set(classIds)];

    // Calculate metrics
    const [studentsCount, totalQuizAttempts] = await Promise.all([
      prisma.student.count({ where: { classId: { in: uniqueClassIds } } }),
      prisma.quizAttempt.findMany({
        where: { quiz: { createdBy: teacher.id } },
        select: { studentId: true, quizId: true, score: true, total: true }
      })
    ]);

    const totalActivities = (teacher._count?.quizzes || 0) + (teacher._count?.assignments || 0) + (teacher._count?.liveClasses || 0);
    const avgPerformance = Math.round(totalActivities * 0.3 * 10) / 10;

    const performanceDistribution = { A: 0, B: 0, C: 0, F: 0 };
    if (totalQuizAttempts.length > 0) {
      // Deduplicate by student and quiz for the chart
      const bestAttemptsMap = {};
      totalQuizAttempts.forEach(att => {
        if (!bestAttemptsMap[att.studentId]) bestAttemptsMap[att.studentId] = {};
        if (!bestAttemptsMap[att.studentId][att.quizId] || att.score > bestAttemptsMap[att.studentId][att.quizId].score) {
          bestAttemptsMap[att.studentId][att.quizId] = att;
        }
      });

      const bestAttempts = Object.values(bestAttemptsMap).flatMap(q => Object.values(q));
      bestAttempts.forEach(attempt => {
        const percent = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;
        if (percent >= 90) performanceDistribution.A++;
        else if (percent >= 80) performanceDistribution.B++;
        else if (percent >= 70) performanceDistribution.C++;
        else performanceDistribution.F++;
      });
      const t = bestAttempts.length;
      if (t > 0) {
        performanceDistribution.A = Math.round((performanceDistribution.A / t) * 100);
        performanceDistribution.B = Math.round((performanceDistribution.B / t) * 100);
        performanceDistribution.C = Math.round((performanceDistribution.C / t) * 100);
        performanceDistribution.F = Math.max(0, 100 - (performanceDistribution.A + performanceDistribution.B + performanceDistribution.C));
      }
    }

    // Gender stats for students in those classes
    const studentsInClasses = await prisma.user.findMany({
      where: { role: 'STUDENT', student: { classId: { in: uniqueClassIds } } },
      select: { gender: true },
    });

    const genderStats = {
      students: {
        male: studentsInClasses.filter(u => u.gender === 'MALE').length,
        female: studentsInClasses.filter(u => u.gender === 'FEMALE').length,
        other: studentsInClasses.filter(u => u.gender === 'OTHER').length,
        unknown: studentsInClasses.filter(u => !u.gender).length,
      }
    };

    res.json({ 
      courses, 
      pendingSubmissions, 
      upcomingClasses, 
      recentResults, 
      genderStats,
      totalStudents: studentsCount,
      avgPerformance,
      performanceDistribution
    });
  } catch (err) {
    console.error('Teacher dashboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getRiskReport = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: req.user.id },
      include: { courseTeachers: { include: { course: { include: { courseClasses: true } } } } }
    });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const classIds = [...new Set(teacher.courseTeachers.flatMap(ct => ct.course.courseClasses.map(cc => cc.classId)))];

    const students = await prisma.student.findMany({
      where: { classId: { in: classIds } },
      include: {
        user: { select: { id: true, name: true, lastLogin: true, email: true } },
        quizAttempts: { select: { quizId: true, score: true, total: true, strikes: true } }
      }
    });

    const report = students.map(s => {
      // Group by quizId and pick max score%
      const bestScores = {};
      s.quizAttempts.forEach(att => {
        const percent = att.total > 0 ? (att.score / att.total) * 100 : att.score; // Fallback if total missing
        if (!bestScores[att.quizId] || percent > bestScores[att.quizId]) {
          bestScores[att.quizId] = percent;
        }
      });

      const percentages = Object.values(bestScores);
      const avgScore = percentages.length > 0 
        ? percentages.reduce((acc, curr) => acc + curr, 0) / percentages.length 
        : null;

      const totalStrikes = s.quizAttempts.reduce((acc, curr) => acc + (curr.strikes || 0), 0);
      const daysInactive = s.user.lastLogin 
        ? Math.floor((new Date() - new Date(s.user.lastLogin)) / (1000 * 60 * 60 * 24)) 
        : 99;

      let riskLevel = 'LOW';
      const reasons = [];

      if (avgScore !== null && avgScore < 50) {
        riskLevel = 'HIGH';
        reasons.push('Low Academic Performance (<50%)');
      } else if (avgScore !== null && avgScore < 65) {
        riskLevel = 'MEDIUM';
        reasons.push('Average Academic Performance (<65%)');
      }

      if (totalStrikes >= 3) {
        riskLevel = 'HIGH';
        reasons.push(`Security Violations (${totalStrikes} Strikes)`);
      }

      if (daysInactive >= 7) {
        riskLevel = 'HIGH';
        reasons.push(`Extended Inactivity (${daysInactive} days)`);
      } else if (daysInactive >= 3) {
        if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
        reasons.push(`Inactivity (${daysInactive} days)`);
      }

      return {
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        class: s.class?.name || 'Unassigned',
        avgScore: avgScore !== null ? Math.round(avgScore) : 'N/A',
        totalStrikes,
        daysInactive,
        riskLevel,
        reasons
      };
    }).filter(r => r.riskLevel !== 'LOW' || r.totalStrikes > 0);

    const sortedReport = report.sort((a, b) => {
      const levels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return levels[b.riskLevel] - levels[a.riskLevel];
    });

    res.json(sortedReport);
  } catch (err) {
    console.error('Teacher risk report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};


// ─── COURSES & TOPICS ───────────────────────────────────
const getMyCourses = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const courses = await prisma.course.findMany({
      where: { courseTeachers: { some: { teacherId: teacher.id } } },
      include: {
        courseClasses: { include: { class: true } }, subject: true,
        topics: { include: { materials: true }, orderBy: { orderIndex: 'asc' } },
        _count: { select: { quizzes: true, assignments: true } },
      },
    });
    res.json(courses);
  } catch (err) {
    logError('Get my courses error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getCourseDetails = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        courseClasses: { include: { class: { include: { students: { include: { user: { select: { id: true, name: true, email: true } } } } } } } },
        subject: true,
        topics: { include: { materials: true }, orderBy: { orderIndex: 'asc' } },
        quizzes: { include: { _count: { select: { quizQuestions: true, quizAttempts: true } } } },
        assignments: { include: { _count: { select: { submissions: true } } } },
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json(course);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createTopic = async (req, res) => {
  try {
    const { courseId, title, description, orderIndex } = req.body;
    const topic = await prisma.topic.create({
      data: { courseId: parseInt(courseId), title, description, orderIndex: orderIndex || 0 },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'TOPIC_CREATE',
        details: `Created topic: "${title}" (Course ID: ${courseId})`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.status(201).json(topic);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { title, description, orderIndex } = req.body;
    const topic = await prisma.topic.update({
      where: { id: parseInt(req.params.id) },
      data: { title, description, orderIndex },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'TOPIC_UPDATE',
        details: `Updated topic ID: ${req.params.id} ("${title}")`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.json(topic);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteTopic = async (req, res) => {
  try {
    await prisma.topic.delete({ where: { id: parseInt(req.params.id) } });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'TOPIC_DELETE',
        details: `Deleted topic ID: ${req.params.id}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.json({ message: 'Topic deleted.' });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── MATERIAL UPLOADS (Resource Library) ──────────────────
const getMyMaterials = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    // Fetch global materials OR materials for topics in courses this teacher is assigned to
    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { isGlobal: true },
          { uploadedBy: req.user.id },
          { topic: { course: { courseTeachers: { some: { teacherId: teacher.id } } } } }
        ]
      },
      include: {
        topic: { include: { course: { include: { subject: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(materials);
  } catch (err) {
    console.error('Get teacher materials error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const uploadMaterial = async (req, res) => {
  try {
    const { title, type, fileUrl, externalUrl, isEmbed, topicId, textContent, isGlobal, description } = req.body;
    
    // Support BOTH multipart file upload (req.file) AND json body (externalUrl/textContent)
    let finalPath = '';
    let finalTitle = title;
    let finalType = type || 'DOCUMENT';
    
    if (req.file) {
      finalPath = req.file.path;
      finalTitle = finalTitle || req.file.originalname;
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (['.pdf'].includes(ext)) finalType = 'PDF';
      else if (['.mp4', '.webm', '.avi'].includes(ext)) finalType = 'VIDEO';
      else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) finalType = 'IMAGE';
      else if (['.doc', '.docx'].includes(ext)) finalType = 'WORD';
    } else if (textContent) {
      finalType = 'TEXT';
      finalPath = 'text-content';
    } else if (externalUrl || fileUrl) {
      finalPath = externalUrl || fileUrl;
      // Simple detection for video links if type is not specified
      if (finalPath.includes('youtube.com') || finalPath.includes('youtu.be') || finalPath.includes('vimeo.com')) {
        finalType = 'VIDEO';
      }
    } else {
      return res.status(400).json({ error: 'No content provided (file, URL, or text).' });
    }

    const globalFlag = isGlobal === 'true' || isGlobal === true;

    const material = await prisma.material.create({
      data: {
        topicId: globalFlag ? null : parseInt(topicId),
        isGlobal: globalFlag,
        type: finalType,
        fileName: finalTitle || 'Untitled',
        filePath: finalPath,
        description: description || null,
        textContent: textContent || null,
        uploadedBy: req.user.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'MATERIAL_UPLOAD',
        details: `Uploaded material: "${finalTitle || 'Untitled'}" (Type: ${finalType})`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.status(201).json(material);
  } catch (err) {
    console.error('Upload material error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, fileUrl, externalUrl, topicId, textContent, isGlobal, description } = req.body;
    
    let dbUpdate = {
        fileName: title,
        filePath: fileUrl || externalUrl || undefined,
        description: description !== undefined ? description : undefined,
        textContent: textContent !== undefined ? textContent : undefined,
        type: type || undefined
    };
    
    if (isGlobal !== undefined) {
      const globalFlag = isGlobal === 'true' || isGlobal === true;
      dbUpdate.isGlobal = globalFlag;
      if (globalFlag) {
        dbUpdate.topicId = null;
      } else if (topicId) {
        dbUpdate.topicId = parseInt(topicId);
      }
    } else if (topicId) {
      dbUpdate.topicId = parseInt(topicId);
    }

    const material = await prisma.material.update({
      where: { id: parseInt(id) },
      data: dbUpdate
    });
    res.json(material);
  } catch (err) {
    console.error('Update teacher material error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    await prisma.material.delete({ where: { id: parseInt(req.params.id) } });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'MATERIAL_DELETE',
        details: `Deleted material ID: ${req.params.id}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.json({ message: 'Material deleted.' });
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── QUIZ SYSTEM ────────────────────────────────────────
const createQuiz = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const { courseId, classIds, title, duration, attemptLimit, questions } = req.body;
    
    const fullQuiz = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          courseId: parseInt(courseId),
          title,
          duration: parseInt(duration) || 30,
          attemptLimit: parseInt(attemptLimit) || 1,
          createdBy: teacher.id,
        },
      });

      if (classIds && Array.isArray(classIds)) {
        for (const cid of classIds) {
          await tx.quizClass.create({
            data: { quizId: quiz.id, classId: parseInt(cid) }
          });
        }
      }

      if (questions && questions.length > 0) {
        for (const q of questions) {
          const question = await tx.quizQuestion.create({
            data: {
              quizId: quiz.id,
              questionText: q.questionText,
              points: q.points || 1,
            },
          });
          if (q.options && Array.isArray(q.options)) {
            for (const opt of q.options) {
              await tx.quizOption.create({
                data: {
                  questionId: question.id,
                  optionLabel: opt.optionLabel || '',
                  optionText: opt.optionText,
                  isCorrect: opt.isCorrect || false,
                },
              });
            }
          }
        }
      }

      const fetched = await tx.quiz.findUnique({
        where: { id: quiz.id },
        include: { quizQuestions: { include: { options: true } }, course: { include: { subject: true } }, quizClasses: true },
      });

      // Targeted Notifications: Notify students in those classes
      if (classIds && classIds.length > 0) {
        const targetStudents = await tx.student.findMany({
          where: { classId: { in: classIds.map(id => parseInt(id)) } },
          select: { userId: true }
        });
        if (targetStudents.length > 0) {
          await tx.notification.createMany({
            data: targetStudents.map(s => ({
              userId: s.userId,
              title: 'New Quiz Posted',
              message: `A new quiz "${title}" has been posted for ${fetched.course.subject.name}.`,
              type: 'ACADEMIC',
              isGlobal: false
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'QUIZ_CREATE',
          details: `Created quiz: "${title}"`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return fetched;
    });

    res.status(201).json(fullQuiz);
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateQuiz = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const { title, duration, attemptLimit, isPublished, questions, classIds } = req.body;

    const fullQuiz = await prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: quizId },
        data: {
          title,
          duration: duration ? parseInt(duration) : undefined,
          attemptLimit: attemptLimit !== undefined ? parseInt(attemptLimit) : undefined,
          isPublished,
        },
      });

      if (classIds && Array.isArray(classIds)) {
        await tx.quizClass.deleteMany({ where: { quizId } });
        for (const cid of classIds) {
          await tx.quizClass.create({
            data: { quizId, classId: parseInt(cid) }
          });
        }
      }

      // Replace all questions if provided
      if (questions && questions.length > 0) {
        await tx.quizQuestion.deleteMany({ where: { quizId } });
        for (const q of questions) {
          const question = await tx.quizQuestion.create({
            data: { quizId, questionText: q.questionText, points: q.points || 1 },
          });
          if (q.options && Array.isArray(q.options)) {
            for (const opt of q.options) {
              await tx.quizOption.create({
                data: {
                  questionId: question.id,
                  optionLabel: opt.optionLabel || '',
                  optionText: opt.optionText,
                  isCorrect: opt.isCorrect || false,
                },
              });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'QUIZ_UPDATE',
          details: `Updated quiz ID: ${quizId} ("${title}")`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return tx.quiz.findUnique({
        where: { id: quizId },
        include: { quizQuestions: { include: { options: true } }, quizClasses: true },
      });
    });

    res.json(fullQuiz);
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    await prisma.quiz.delete({ where: { id: parseInt(req.params.id) } });
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'QUIZ_DELETE',
        details: `Deleted quiz ID: ${req.params.id}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    res.json({ message: 'Quiz deleted.' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getQuizById = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        quizQuestions: { include: { options: true } },
        course: { include: { subject: true } }
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    res.json(quiz);
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getQuizResults = async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: parseInt(req.params.id) },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        answers: { include: { question: true, option: true } },
      },
      orderBy: { score: 'desc' },
    });
    res.json(attempts);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── ASSIGNMENTS ────────────────────────────────────────
const createAssignment = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const { courseId, classIds, title, description, deadline, maxScore } = req.body;
    
    // Parse classIds if it came as a JSON string (due to multipart form)
    let parsedClassIds = [];
    if (classIds) {
      try {
        parsedClassIds = typeof classIds === 'string' ? JSON.parse(classIds) : classIds;
      } catch (e) {
        parsedClassIds = Array.isArray(classIds) ? classIds : [classIds];
      }
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const ass = await tx.assignment.create({
        data: {
          courseId: parseInt(courseId), title, description,
          deadline: new Date(deadline), maxScore: parseInt(maxScore) || 100,
          filePath: req.file ? req.file.path : null,
          createdBy: teacher.id,
        },
      });

      if (parsedClassIds && Array.isArray(parsedClassIds)) {
        for (const cid of parsedClassIds) {
          await tx.assignmentClass.create({
            data: { assignmentId: ass.id, classId: parseInt(cid) }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ASSIGNMENT_CREATE',
          details: `Created assignment: "${title}"`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return ass;
    });

    res.status(201).json(assignment);
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const { title, description, deadline, maxScore, classIds } = req.body;
    
    const updateData = {
      title,
      description,
      deadline: deadline ? new Date(deadline) : undefined,
      maxScore: maxScore ? parseInt(maxScore) : undefined,
    };

    if (req.file) {
      updateData.filePath = req.file.path;
    }

    let parsedClassIds = [];
    if (classIds) {
      try {
        parsedClassIds = typeof classIds === 'string' ? JSON.parse(classIds) : classIds;
      } catch (e) {
        parsedClassIds = Array.isArray(classIds) ? classIds : [classIds];
      }
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const ass = await tx.assignment.update({
        where: { id: assignmentId },
        data: updateData,
      });

      if (parsedClassIds && Array.isArray(parsedClassIds)) {
        await tx.assignmentClass.deleteMany({ where: { assignmentId } });
        for (const cid of parsedClassIds) {
          await tx.assignmentClass.create({
            data: { assignmentId, classId: parseInt(cid) }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ASSIGNMENT_UPDATE',
          details: `Updated assignment ID: ${assignmentId} ("${title}")`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return ass;
    });
    res.json(assignment);
  } catch (err) {
    console.error('Update assignment error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getAssignmentSubmissions = async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: parseInt(req.params.id) },
      include: { student: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(submissions);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const { grade, feedback } = req.body;
    const submission = await prisma.submission.update({
      where: { id: parseInt(req.params.id) },
      data: { grade: parseFloat(grade), feedback },
      include: { student: { include: { user: { select: { name: true } } } } }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SUBMISSION_GRADE',
        details: `Graded student submission (Student: ${submission.student?.user?.name || 'N/A'}, Grade: ${grade})`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json(submission);
  } catch (err) {
    console.error('Grade submission error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    
    // Check if assignment exists and belongs to the teacher
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    if (assignment.createdBy !== teacher.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this assignment.' });
    }

    // Delete associated submissions first (if not cascading)
    await prisma.submission.deleteMany({ where: { assignmentId } });
    
    // Delete assignment
    await prisma.assignment.delete({ where: { id: assignmentId } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ASSIGNMENT_DELETE',
        details: `Deleted assignment ID: ${assignmentId} ("${assignment.title}")`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });
    
    res.json({ message: 'Assignment deleted successfully.' });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const exportAssignmentGrades = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { 
        submissions: { 
          include: { student: { include: { user: true } } } 
        } 
      }
    });

    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

    const fields = ['Student Name', 'Email', 'Grade', 'Max Score', 'Submitted At'];
    const data = assignment.submissions.map(s => ({
      'Student Name': s.student?.user?.name || 'N/A',
      'Email': s.student?.user?.email || 'N/A',
      'Grade': s.grade !== null ? s.grade : 'N/A',
      'Max Score': assignment.maxScore,
      'Submitted At': new Date(s.submittedAt).toLocaleString()
    }));

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=assignment_${assignmentId}_grades.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('Export grades error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── ATTENDANCE ─────────────────────────────────────────
const markAttendance = async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    const results = [];
    for (const record of records) {
      const att = await prisma.attendance.upsert({
        where: {
          studentId_classId_date: {
            studentId: parseInt(record.studentId),
            classId: parseInt(classId),
            date: new Date(date),
          },
        },
        update: { status: record.status },
        create: {
          studentId: parseInt(record.studentId),
          classId: parseInt(classId),
          date: new Date(date),
          status: record.status,
        },
      });
      results.push(att);
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ATTENDANCE_MARK',
        details: `Recorded attendance for Class ID: ${classId} on Date: ${date} (${records.length} records)`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json({ message: 'Attendance recorded.', records: results });
  } catch (err) {
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { classId, date, startDate, endDate } = req.query;
    const where = {};
    if (classId) where.classId = parseInt(classId);
    if (date) where.date = new Date(date);
    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    const attendance = await prisma.attendance.findMany({
      where,
      include: { student: { include: { user: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
    });
    res.json(attendance);
  } catch (err) {
    console.error('Get my courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── LIVE CLASSES ───────────────────────────────────────
const createLiveClass = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const { title, classId, googleMeetLink, scheduleDate, scheduleTime, duration } = req.body;
    const liveClass = await prisma.liveClass.create({
      data: {
        title,
        classId: parseInt(classId),
        teacherId: teacher.id,
        googleMeetLink,
        scheduleDate: new Date(scheduleDate),
        scheduleTime,
        duration: parseInt(duration) || 60,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LIVECLASS_CREATE',
        details: `Created live class: "${title}"`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.status(201).json(liveClass);
  } catch (err) {
    console.error('Create live class error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getMyLiveClasses = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const classes = await prisma.liveClass.findMany({
      where: { teacherId: teacher.id },
      include: { class: true },
      orderBy: { scheduleDate: 'desc' },
    });
    res.json(classes);
  } catch (err) {
    console.error('Get my live classes error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateLiveClass = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const liveClassId = parseInt(req.params.id);
    const { title, classId, googleMeetLink, scheduleDate, scheduleTime, duration } = req.body;

    const liveClass = await prisma.liveClass.findUnique({ where: { id: liveClassId } });
    if (!liveClass) return res.status(404).json({ error: 'Live class not found.' });

    if (liveClass.teacherId !== teacher.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized to update this live class.' });
    }

    const updated = await prisma.liveClass.update({
      where: { id: liveClassId },
      data: {
        title,
        classId: classId ? parseInt(classId) : undefined,
        googleMeetLink,
        scheduleDate: scheduleDate ? new Date(scheduleDate) : undefined,
        scheduleTime,
        duration: duration ? parseInt(duration) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LIVECLASS_UPDATE',
        details: `Updated live class ID: ${liveClassId} ("${title}")`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json(updated);
  } catch (err) {
    console.error('Update live class error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteLiveClass = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const liveClassId = parseInt(req.params.id);
    const liveClass = await prisma.liveClass.findUnique({ where: { id: liveClassId } });

    if (!liveClass) return res.status(404).json({ error: 'Live class not found.' });
    if (liveClass.teacherId !== teacher.id && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this live class.' });
    }

    await prisma.liveClass.delete({ where: { id: liveClassId } });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LIVECLASS_DELETE',
        details: `Deleted live class ID: ${liveClassId} ("${liveClass.title}")`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json({ message: 'Live class deleted successfully.' });
  } catch (err) {
    console.error('Delete live class error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── MY QUIZZES (Teacher) ──────────────────────────────
const getMyQuizzes = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const quizzes = await prisma.quiz.findMany({
      where: { createdBy: teacher.id },
      include: {
        course: { include: { courseClasses: { include: { class: true } }, subject: true } },
        quizClasses: { include: { class: { select: { name: true } } } },
        _count: { select: { quizQuestions: true, quizAttempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quizzes);
  } catch (err) {
    logError('Get my quizzes error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── MY ASSIGNMENTS (Teacher) ──────────────────────────
const getMyAssignments = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const assignments = await prisma.assignment.findMany({
      where: { createdBy: teacher.id },
      include: {
        course: { include: { courseClasses: { include: { class: true } }, subject: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    logError('Get my assignments error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── TEACHER ANALYTICS ────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    // Fetch related stats
    const courses = await prisma.course.findMany({ where: { courseTeachers: { some: { teacherId: teacher.id } } } });
    const coursesActive = courses.length;

    const teacherClasses = await prisma.courseClass.findMany({ where: { courseId: { in: courses.map(c => c.id) } } });
    const totalEnrollments = await prisma.student.count({ where: { classId: { in: teacherClasses.map(c => c.classId) } } });

    const attempts = await prisma.quizAttempt.findMany({
      where: { quiz: { createdBy: teacher.id } }
    });

    const avgScoreData = attempts.length > 0 ? attempts.reduce((a, b) => a + b.score, 0) / attempts.length : 0;
    const avgGrade = avgScoreData.toFixed(1);

    let gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    attempts.forEach(r => {
      let score = r.score;
      if (score >= 90) gradeDist.A++;
      else if (score >= 80) gradeDist.B++;
      else if (score >= 70) gradeDist.C++;
      else if (score >= 60) gradeDist.D++;
      else gradeDist.F++;
    });
    const gradeDistribution = [
      { name: 'A (90-100)', value: gradeDist.A, color: 'hsl(152, 60%, 42%)' },
      { name: 'B (80-89)', value: gradeDist.B, color: 'hsl(210, 90%, 55%)' },
      { name: 'C (70-79)', value: gradeDist.C, color: 'hsl(38, 92%, 50%)' },
      { name: 'D (60-69)', value: gradeDist.D, color: 'hsl(25, 90%, 55%)' },
      { name: 'F (<60)', value: gradeDist.F, color: 'hsl(0, 72%, 55%)' },
    ];

    res.json({
      statCards: {
        totalEnrollments,
        coursesActive,
        avgGrade: `${avgGrade}%`,
        completionRate: 'N/A'
      },
      studentPerformance: [{ subject: 'Teacher Overview', score: avgScoreData }],
      enrollmentTrend: [{ month: 'Current', students: totalEnrollments }],
      gradeDistribution,
      teacherActivity: []
    });
  } catch (err) {
    console.error('Teacher analytics error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── TEACHER GRADEBOOK ────────────────────────────────
const getGradebook = async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

    const attempts = await prisma.quizAttempt.findMany({
      where: { quiz: { createdBy: teacher.id } },
      include: {
        student: { include: { user: { select: { name: true, email: true } }, class: true } },
        quiz: { include: { course: { include: { subject: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Group by student AND quiz to pick the best attempt for each quiz
    const studentMap = {};
    attempts.forEach(r => {
      const sid = r.studentId;
      const qid = r.quizId;
      
      if (!studentMap[sid]) {
        studentMap[sid] = {
          id: sid,
          studentName: r.student?.user?.name || 'Unknown',
          email: r.student?.user?.email || '',
          className: r.student?.class?.name || 'N/A',
          bestScores: {}, // quizId -> attemptData
        };
      }
      
      const currentBest = studentMap[sid].bestScores[qid];
      if (!currentBest || r.score > currentBest.score) {
        studentMap[sid].bestScores[qid] = r;
      }
    });

    const gradebook = Object.values(studentMap).map((s) => {
      const results = Object.values(s.bestScores);
      const totalScore = results.reduce((sum, r) => sum + r.score, 0);
      const count = results.length;
      return {
        id: s.id,
        studentName: s.studentName,
        email: s.email,
        className: s.className,
        results: results,
        totalScore,
        count,
        average: count > 0 ? Math.round(totalScore / count) : 0,
      };
    });

    res.json(gradebook);
  } catch (err) {
    console.error('Teacher gradebook error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── TEACHER NOTES ───────────────────────────────────
const getMyNotes = async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    logError('Get my notes error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createNote = async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const note = await prisma.note.create({
      data: {
        userId: req.user.id,
        title: title || 'Untitled Note',
        content: content || '',
        category: category || 'General',
      },
    });
    res.status(201).json(note);
  } catch (err) {
    logError('Create note error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateNote = async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const note = await prisma.note.update({
      where: { id: parseInt(req.params.id) },
      data: { title, content, category },
    });
    res.json(note);
  } catch (err) {
    logError('Update note error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteNote = async (req, res) => {
  try {
    await prisma.note.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Note deleted.' });
  } catch (err) {
    logError('Delete note error', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

 // Removed duplicate getRiskReport 


const exportQuizToWord = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        quizQuestions: { include: { options: true } },
        course: { include: { subject: true } },
        class: true
      }
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    if (quiz.createdBy !== teacher.id) return res.status(403).json({ error: 'Unauthorized to export this quiz' });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [ new TextRun({ text: quiz.title || 'Untitled Quiz', bold: true, size: 36 }) ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [ new TextRun({ text: `Subject: ${quiz.course?.subject?.name || 'Unknown'}`, size: 28, bold: true }) ],
            spacing: { after: 100 }
          }),
          new Paragraph({
            children: [ new TextRun({ text: `Class: ${quiz.class?.name || 'Unknown'}`, size: 24, italics: true }) ],
            spacing: { after: 400 }
          }),
          ...quiz.quizQuestions.flatMap((q, index) => {
             const paras = [
               new Paragraph({
                 children: [
                   new TextRun({ text: `${index + 1}. ${q.questionText || 'Empty Question'}`, bold: true, size: 28 })
                 ],
                 spacing: { before: 200, after: 100 }
               }),
               ...q.options.map((opt) => new Paragraph({
                 children: [
                   new TextRun({ 
                     text: `   ${opt.optionLabel || ''}. ${opt.optionText || 'Empty Option'}${opt.isCorrect ? ' (Correct Answer)' : ''}`,
                     italics: !!opt.isCorrect,
                     bold: !!opt.isCorrect,
                     size: 24
                   })
                 ]
               }))
             ];
             return paras;
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="Quiz_${quizId}.docx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    logError('Export quiz to docx error', err);
    res.status(500).json({ error: 'Server error while generating Word document.' });
  }
};

const exportQuizToCSV = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        quizQuestions: {
          include: { options: { orderBy: { optionLabel: 'asc' } } }
        }
      }
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const fields = [
      'Question Text', 'Points', 
      'Option A', 'A Correct', 
      'Option B', 'B Correct', 
      'Option C', 'C Correct', 
      'Option D', 'D Correct'
    ];
    
    const data = quiz.quizQuestions.map(q => {
      const row = {
        'Question Text': q.questionText,
        'Points': q.points,
      };
      
      const labels = ['A', 'B', 'C', 'D'];
      labels.forEach(label => {
        const opt = q.options.find(o => o.optionLabel === label);
        row[`Option ${label}`] = opt ? opt.optionText : '';
        row[`${label} Correct`] = opt ? (opt.isCorrect ? 'YES' : 'NO') : 'NO';
      });
      
      return row;
    });

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=Quiz_${quizId}_Questions.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    logError('Export quiz to CSV error', err);
    res.status(500).json({ error: 'Server error while exporting CSV.' });
  }
};

const importQuizFromCSV = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const csvParser = require('csv-parser');
    const results = [];
    const stream = fs.createReadStream(req.file.path).pipe(csvParser());

    for await (const row of stream) {
      results.push(row);
    }

    // Basic Validation
    if (results.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing questions
      await tx.quizQuestion.deleteMany({ where: { quizId } });

      for (const row of results) {
        const questionText = row['Question Text'] || row['questionText'];
        const points = parseInt(row['Points'] || row['points'] || '1');
        
        if (!questionText) continue;

        const question = await tx.quizQuestion.create({
          data: { quizId, questionText, points }
        });

        const labels = ['A', 'B', 'C', 'D'];
        for (const label of labels) {
          const optText = row[`Option ${label}`] || row[`option${label}`];
          const isCorrectStr = (row[`${label} Correct`] || row[`${label}Correct`] || row[`isCorrect${label}`] || '').toUpperCase();
          const isCorrect = isCorrectStr === 'YES' || isCorrectStr === 'TRUE' || isCorrectStr === '1';

          if (optText) {
            await tx.quizOption.create({
              data: {
                questionId: question.id,
                optionLabel: label,
                optionText: optText,
                isCorrect
              }
            });
          }
        }
      }
    });

    // Cleanup temp file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({ message: 'Quiz questions imported successfully!', count: results.length });
  } catch (err) {
    logError('Import quiz CSV error', err);
    res.status(500).json({ error: 'Server error while importing CSV.' });
  }
};

module.exports = {
  getDashboard, getRiskReport,
  getMyCourses, getCourseDetails, createTopic, updateTopic, deleteTopic,
  getMyMaterials, uploadMaterial, updateMaterial, deleteMaterial,
  createQuiz, updateQuiz, deleteQuiz, getQuizById, getQuizResults,
  createAssignment, updateAssignment, getAssignmentSubmissions, gradeSubmission, deleteAssignment, exportAssignmentGrades,
  markAttendance, getAttendance,
  createLiveClass, getMyLiveClasses, updateLiveClass, deleteLiveClass,
  getMyQuizzes, getMyAssignments,
  getAnalytics, getGradebook,
  getMyNotes, createNote, updateNote, deleteNote,
  exportQuizToWord,
  exportQuizToCSV,
  importQuizFromCSV,
};
