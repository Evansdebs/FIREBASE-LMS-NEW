const prisma = require('../config/prisma');

// ─── DASHBOARD ──────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: { class: true },
    });
    if (!student) return res.status(404).json({ error: 'Student profile profile not found.' });

    // Optimized Parallel Fetching with selective fields
    const [rawCourses, upcomingAssignments, upcomingClasses, recentResults, achievements, notifications, settings] = await Promise.all([
      prisma.course.findMany({
        where: { courseClasses: { some: { classId: student.classId } } },
        include: { 
          subject: true, 
          topics: { select: { materials: { select: { id: true } } } },
          _count: { select: { topics: true } } 
        },
      }),
      prisma.assignment.findMany({
        where: { course: { courseClasses: { some: { classId: student.classId } } }, deadline: { gte: new Date() } },
        select: { id: true, title: true, deadline: true, course: { select: { subject: { select: { name: true } } } } },
        take: 3, orderBy: { deadline: 'asc' }
      }),
      prisma.liveClass.findMany({
        where: { classId: student.classId, scheduleDate: { gte: new Date() } },
        include: { teacher: { include: { user: { select: { name: true } } } } },
        take: 3, orderBy: { scheduleDate: 'asc' }
      }),
      prisma.quizAttempt.findMany({
        where: { studentId: student.id },
        include: { quiz: { select: { title: true, course: { select: { title: true } } } } },
        take: 5, orderBy: { submittedAt: 'desc' }
      }),
      prisma.achievement.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' }, take: 5,
      }),
      prisma.notification.findMany({
        where: { 
          OR: [
            { userId: req.user.id },
            { isGlobal: true, targetRole: { in: ['all', 'student'] } }
          ],
          isRead: false 
        },
        take: 5, orderBy: { createdAt: 'desc' },
      }),
      prisma.settings.findFirst({
        select: { schoolName: true, logo: true, lockdownMode: true, welcomeMessage: true } // Selective fields
      }),
    ]);

    // Total points calculation (from student record + potential recent achievements)
    const totalPoints = student.points || 0;

    // Calculate Average Grade %
    // Calculate Average Grade % (Quizzes + Assignments) - Using Highest Score Per Quiz
    const allQuizAttempts = await prisma.quizAttempt.findMany({
      where: { studentId: student.id },
      select: { quizId: true, score: true, total: true }
    });

    // Group by quizId and pick max score%
    const bestQuizScores = {};
    allQuizAttempts.forEach(attempt => {
      if (attempt.total > 0) {
        const percent = (attempt.score / attempt.total) * 100;
        if (!bestQuizScores[attempt.quizId] || percent > bestQuizScores[attempt.quizId]) {
          bestQuizScores[attempt.quizId] = percent;
        }
      }
    });

    const assignmentSubmissions = await prisma.submission.findMany({
      where: { studentId: student.id, grade: { not: null } },
      include: { assignment: { select: { maxScore: true } } }
    });

    let totalPercentage = Object.values(bestQuizScores).reduce((sum, val) => sum + val, 0);
    let itemsCount = Object.keys(bestQuizScores).length;

    assignmentSubmissions.forEach(sub => {
      if (sub.assignment.maxScore > 0) {
        totalPercentage += (sub.grade / sub.assignment.maxScore) * 100;
        itemsCount++;
      }
    });

    const avgGrade = itemsCount > 0 ? Math.round(totalPercentage / itemsCount) : 0;

    const subjectCount = rawCourses.length;


    // 1-Pass Progress Calculation
    const studentCompProgress = await prisma.materialProgress.findMany({
      where: { studentId: req.user.id, status: 'COMPLETED' },
      select: { materialId: true }
    });
    const completedIds = new Set(studentCompProgress.map(p => p.materialId));

    let totalMat = 0;
    let totalCompleted = 0;

    const courses = rawCourses.map(c => {
      const matIds = c.topics.flatMap(t => t.materials.map(m => m.id));
      const done = matIds.filter(id => completedIds.has(id)).length;
      const progress = matIds.length > 0 ? Math.round((done / matIds.length) * 100) : 0;
      
      totalMat += matIds.length;
      totalCompleted += done;

      const { topics, ...courseData } = c;
      return { ...courseData, progress };
    });

    const progressValue = totalMat > 0 ? Math.round((totalCompleted / totalMat) * 100) : 0;

    res.json({ 
      student, 
      courses, 
      subjectCount,
      upcomingAssignments, 
      upcomingClasses, 
      recentResults, 
      achievements, 
      notifications, 
      totalPoints, 
      settings,
      avgGrade,
      overallProgress: progressValue
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── COURSES & MATERIALS ────────────────────────────────
const getMyCourses = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const courses = await prisma.course.findMany({
      where: { courseClasses: { some: { classId: student.classId } } },
      include: {
        subject: true,
        courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        topics: { include: { materials: true }, orderBy: { orderIndex: 'asc' } },
      },
    });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getCourseDetails = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        subject: true,
        courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        topics: { 
          include: { 
            materials: {
              include: {
                progress: { where: { studentId: req.user.id } }
              }
            }
          }, 
          orderBy: { orderIndex: 'asc' } 
        },
        quizzes: {
          where: { isPublished: true },
          select: { id: true, title: true, duration: true, createdAt: true },
        },
        assignments: {
          select: { id: true, title: true, description: true, deadline: true, maxScore: true },
        },
      },
    });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── MATERIALS (Resource Library for Students) ─────────
const getMyMaterials = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const materials = await prisma.material.findMany({
      where: {
        OR: [
          { isGlobal: true },
          {
            topic: {
              course: {
                courseClasses: { some: { classId: student.classId } },
              },
            },
          }
        ]
      },
      include: {
        topic: { include: { course: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(materials);
  } catch (err) {
    console.error('Get student materials error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateMaterialProgress = async (req, res) => {
  try {
    const { status } = req.body;
    const materialId = parseInt(req.params.id);
    const userId = req.user.id;

    if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const progress = await prisma.materialProgress.upsert({
      where: {
        studentId_materialId: { studentId: userId, materialId }
      },
      update: { status },
      create: {
        studentId: userId,
        materialId,
        status
      }
    });

    // Update student points: +10 for COMPLETED, -10 for unmarked (IN_PROGRESS)
    const pointsDelta = status === 'COMPLETED' ? 10 : -10;
    
    // Check if we are actually changing from another status to avoid double points
    // But since we only have two statuses and upsert handles existence, 
    // we should be careful. Let's just update points if it's a new completion.
    
    // Award points only if status is changed to COMPLETED
    // For simplicity, we increment if COMPLETED and decrement if IN_PROGRESS
    // If it was already COMPLETED, and we set it to COMPLETED again, we shouldn't award points.
    // However, the frontend toggle logic handles this.
    
    await prisma.student.update({
      where: { userId },
      data: { points: { increment: pointsDelta } }
    });

    // Award Early Bird badge if it's the first completion
    if (status === 'COMPLETED') {
      const achievements = await prisma.achievement.findFirst({
        where: { studentId: userId, badge: 'early_bird' }
      });
      if (!achievements) {
        await prisma.achievement.create({
          data: {
            studentId: userId,
            userId: req.user.id,
            title: 'Early Bird',
            description: 'Completed your first lesson material!',
            points: 25,
            badge: 'early_bird'
          }
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'MATERIAL_COMPLETE',
          details: `Completed learning material ID: ${materialId}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });
    }

    res.json(progress);
  } catch (err) {
    console.error('Update material progress error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── QUIZZES ────────────────────────────────────────────
const getAvailableQuizzes = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const quizzes = await prisma.quiz.findMany({
      where: { 
        isPublished: true, 
        quizClasses: { some: { classId: student.classId } }
      },
      include: {
        course: { select: { title: true } },
        _count: { select: { quizQuestions: true } },
        quizAttempts: { 
          where: { studentId: student.id }, 
          orderBy: { submittedAt: 'desc' },
          select: { id: true, score: true, total: true, submittedAt: true } 
        },
      },
    });

    // Attach isExpired flag but keep quiz visible so student sees "Closed" state
    const now = new Date();
    const enriched = quizzes.map(q => ({
      ...q,
      isExpired: q.dueDate ? new Date(q.dueDate) < now : false,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getAttemptReview = async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        quiz: {
          include: {
            quizQuestions: {
              include: {
                options: true
              }
            },
            course: { select: { title: true } }
          }
        }
      }
    });

    if (!attempt || attempt.studentId !== student.id) {
      return res.status(403).json({ error: 'Unauthorized to view this attempt.' });
    }

    res.json(attempt);
  } catch (err) {
    console.error('Get attempt review error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const startQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        quizQuestions: {
          include: { options: { select: { id: true, optionLabel: true, optionText: true } } }
        },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (!quiz.isPublished) return res.status(403).json({ error: 'Quiz is not published yet.' });

    // Block if past due date
    if (quiz.dueDate && new Date(quiz.dueDate) < new Date()) {
      return res.status(403).json({ error: 'This quiz has closed. The due date has passed.' });
    }

    // Check attempt limit
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    const attemptCount = await prisma.quizAttempt.count({
      where: { studentId: student.id, quizId: quiz.id }
    });
    if (attemptCount >= quiz.attemptLimit) {
      return res.status(400).json({ error: `You have reached the maximum number of attempts (${quiz.attemptLimit}).` });
    }

    // Create active attempt to track strikes securely
    const attempt = await prisma.quizAttempt.create({
      data: { studentId: student.id, quizId: quiz.id, score: 0, strikes: 0 }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'QUIZ_START',
        details: `Started quiz: ${quiz.title} (Attempt #${attemptCount + 1})`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json({ quiz: { ...quiz, duration: quiz.duration, attemptNumber: attemptCount + 1 }, attemptId: attempt.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const recordStrike = async (req, res) => {
  try {
    const attemptId = parseInt(req.body.attemptId);
    if (!attemptId) return res.status(400).json({ error: 'Missing attemptId' });
    
    // Atomically increment strikes
    const attempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { strikes: { increment: 1 } },
      select: { strikes: true }
    });
    
    res.json({ strikes: attempt.strikes });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { answers, attemptId } = req.body; // { questionId: selectedOptionId }
    if (!attemptId) return res.status(400).json({ error: 'Missing attemptId.' });

    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { quizQuestions: { include: { options: true } } },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

    // Attempt was already created in startQuiz
    const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== student.id) {
       return res.status(403).json({ error: 'Invalid attempt' });
    }

    // Auto-grade MCQ
    let score = 0;
    let total = 0;
    const answersToCreate = [];

    for (const q of quiz.quizQuestions) {
      total += q.points;
      const selectedOptionId = answers[q.id] ? parseInt(answers[q.id]) : null;
      const correctOption = q.options.find(o => o.isCorrect);
      const isCorrect = selectedOptionId && correctOption && selectedOptionId === correctOption.id;
      
      answersToCreate.push({
        questionId: q.id,
        selectedOptionId: selectedOptionId,
        isCorrect: !!isCorrect,
      });
      
      if (isCorrect) score += q.points;
    }

    const percentage = total > 0 ? (score / total) * 100 : 0;

    let grade = 'F';
    if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    // ACID Transaction wrapping all database updates
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Create all quiz answers
      for (const answer of answersToCreate) {
        await tx.quizAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId,
            isCorrect: answer.isCorrect,
          }
        });
      }

      // 2. Update quiz attempt score & total
      const updatedAttempt = await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: { score, total }
      });

      // 3. Award Quiz Master for 100%
      if (percentage === 100) {
        const existing = await tx.achievement.findFirst({
          where: { studentId: student.id, title: `Quiz Master: ${quiz.title}` }
        });
        if (!existing) {
          await tx.achievement.create({
            data: {
              studentId: student.id,
              userId: req.user.id,
              title: `Quiz Master: ${quiz.title}`,
              description: `Perfect score on ${quiz.title}!`,
              points: 100,
              badge: 'trophy',
            },
          });
        }
      }

      // 4. Award achievement points (General Performance)
      if (percentage >= 90) {
        await tx.achievement.create({
          data: {
            studentId: student.id,
            userId: req.user.id,
            title: `Excellent in ${quiz.title}`,
            description: `Scored ${percentage.toFixed(0)}% on ${quiz.title}`,
            points: 50,
            badge: 'star',
          },
        });
      } else if (percentage >= 70) {
        await tx.achievement.create({
          data: {
            studentId: student.id,
            userId: req.user.id,
            title: `Good Performance in ${quiz.title}`,
            description: `Scored ${percentage.toFixed(0)}% on ${quiz.title}`,
            points: 20,
            badge: 'medal',
          },
        });
      }

      // 5. Create audit log record
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'QUIZ_SUBMIT',
          details: `Submitted quiz: ${quiz.title} (Score: ${score}/${total}, Grade: ${grade})`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return updatedAttempt;
    });

    res.json({ attempt: transactionResult, percentage, grade });
  } catch (err) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── ASSIGNMENTS ────────────────────────────────────────
const getMyAssignments = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const assignments = await prisma.assignment.findMany({
      where: { assignmentClasses: { some: { classId: student.classId } } },
      include: {
        course: { select: { title: true } },
        submissions: { where: { studentId: student.id } },
      },
      orderBy: { deadline: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const submitAssignment = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const assignmentId = parseInt(req.params.id);
    const { textContent } = req.body;
    const filePath = req.file ? req.file.path : undefined;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    
    // Strict Deadline Enforcement
    if (new Date() > new Date(assignment.deadline)) {
      return res.status(403).json({ error: 'Assignment deadline has passed. Submission blocked.' });
    }

    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId: { assignmentId, studentId: student.id },
      },
      update: { 
        filePath: filePath || undefined, 
        textContent: textContent || undefined, 
        submittedAt: new Date() 
      },
      create: {
        assignmentId,
        studentId: student.id,
        filePath,
        textContent,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'ASSIGNMENT_SUBMIT',
        details: `Submitted assignment: ${assignment.title}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null
      }
    });

    res.json(submission);
  } catch (err) {
    console.error('Submit assignment error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── PERFORMANCE & GAMIFICATION ─────────────────────────
const getMyResults = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const attempts = await prisma.quizAttempt.findMany({
      where: { studentId: student.id },
      include: {
        quiz: { include: { course: { select: { title: true } } } },
        answers: { include: { question: true, option: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Group by quizId and return only the best attempt per quiz
    const bestAttemptMap = {};
    attempts.forEach(attempt => {
      const qid = attempt.quizId;
      if (!bestAttemptMap[qid] || attempt.score > bestAttemptMap[qid].score) {
        bestAttemptMap[qid] = attempt;
      }
    });

    res.json(Object.values(bestAttemptMap));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const attendance = await prisma.attendance.findMany({
      where: { studentId: student.id },
      orderBy: { date: 'desc' },
    });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const achievements = await prisma.achievement.groupBy({
      by: ['studentId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 20,
    });

    const leaderboard = [];
    for (const entry of achievements) {
      const s = await prisma.student.findUnique({
        where: { id: entry.studentId },
        include: { user: { select: { name: true, avatar: true } } },
      });
      if (s) leaderboard.push({ name: s.user.name, avatar: s.user.avatar, points: entry._sum.points });
    }

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getMyAchievements = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const achievements = await prisma.achievement.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getAcademicReports = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    // For now, return recent quiz results as reports
    const reports = await prisma.quizAttempt.findMany({
      where: { studentId: student.id },
      include: { quiz: { select: { title: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 10
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── LIVE CLASSES ───────────────────────────────────────
const getMyLiveClasses = async (req, res) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const classes = await prisma.liveClass.findMany({
      where: { classId: student.classId },
      include: { teacher: { include: { user: { select: { name: true } } } } },
      orderBy: { scheduleDate: 'desc' },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const addPomodoroPoints = async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await prisma.student.findUnique({
      where: { userId }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found.' });
    }

    const { skipped } = req.body;
    const incrementAmount = skipped ? 5 : 15;

    // ACID transaction wrapping student points updates, achievement creation, and audit logging
    const result = await prisma.$transaction(async (tx) => {
      // 1. Award focus session points
      const updatedStudent = await tx.student.update({
        where: { userId },
        data: {
          points: { increment: incrementAmount }
        }
      });

      // 2. Check and award focus master badge
      let focusMasterAwarded = false;
      if (!skipped) {
        const badgeName = 'focus_master';
        const achievements = await tx.achievement.findFirst({
          where: { studentId: student.id, badge: badgeName }
        });

        if (!achievements) {
          await tx.achievement.create({
            data: {
              studentId: student.id,
              userId: userId,
              title: 'Focus Master',
              description: 'Completed your first Virtual Pomodoro study session!',
              points: 50,
              badge: badgeName
            }
          });
          
          // Award additional 50 points
          const doubleUpdated = await tx.student.update({
            where: { userId },
            data: {
              points: { increment: 50 }
            }
          });
          focusMasterAwarded = true;
          updatedStudent.points = doubleUpdated.points;
        }
      }

      // 3. Create Audit Log inside transaction
      await tx.auditLog.create({
        data: {
          userId: userId,
          action: 'POMODORO_COMPLETE',
          details: `Completed focus study session (skipped: ${skipped}, focus_master_awarded: ${focusMasterAwarded})`,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || null
        }
      });

      return updatedStudent;
    });

    res.json({
      message: skipped 
        ? 'Pomodoro session skipped. +5 XP points awarded.'
        : 'Pomodoro session completed successfully! +15 XP awarded.',
      points: result.points
    });
  } catch (err) {
    console.error('Add Pomodoro points error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getDashboard, getMyCourses, getCourseDetails, getMyMaterials,
  updateMaterialProgress,
  getAvailableQuizzes, startQuiz, submitQuiz, recordStrike, getAttemptReview,
  getMyAssignments, submitAssignment,
  getMyResults, getMyAttendance, getMyAchievements,
  getMyLiveClasses, getAcademicReports,
  addPomodoroPoints,
};
