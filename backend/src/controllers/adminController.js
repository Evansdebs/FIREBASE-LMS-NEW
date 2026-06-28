const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { Parser } = require('json2csv');
const prisma = require('../config/prisma');

// ─── DASHBOARD ──────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalClasses, totalSubjects, totalCourses, recentUsers, activeUsers, upcomingClasses, settings] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.course.count(),
      prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.liveClass.findMany({ where: { scheduleDate: { gte: new Date() } }, take: 5, orderBy: { scheduleDate: 'asc' }, include: { teacher: { include: { user: true } } } }),
      prisma.settings.findFirst(),
    ]);

    // ─── GENDER STATS ───────────────────────────────────────
    const [studentUsers, teacherUsers] = await Promise.all([
      prisma.user.findMany({ where: { role: 'STUDENT' }, select: { gender: true } }),
      prisma.user.findMany({ where: { role: 'TEACHER' }, select: { gender: true } }),
    ]);

    const countGender = (users) => ({
      male: users.filter(u => u.gender === 'MALE').length,
      female: users.filter(u => u.gender === 'FEMALE').length,
      other: users.filter(u => u.gender === 'OTHER').length,
      unknown: users.filter(u => !u.gender).length,
    });

    const genderStats = {
      students: countGender(studentUsers),
      teachers: countGender(teacherUsers),
    };

    const systemHealth = {
      uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
      memory: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024 * 10) / 10} / ${Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10} GB`,
      cpuLoad: os.loadavg()[0].toFixed(2),
      platform: os.platform(),
    };

    // ─── STUDENT RANKINGS (Points + Performance) ─────────────
    const rawStudents = await prisma.student.findMany({
      include: {
        user: { select: { name: true, avatar: true } },
        class: { select: { name: true } },
        quizAttempts: { select: { quizId: true, score: true, total: true } }
      }
    });

    const studentRankings = rawStudents.map(s => {
      // Group by quizId, pick max score % per quiz
      const bestScores = {};
      s.quizAttempts.forEach(att => {
        const percent = att.total > 0 ? (att.score / att.total) * 100 : 0;
        if (!bestScores[att.quizId] || percent > bestScores[att.quizId]) {
          bestScores[att.quizId] = percent;
        }
      });
      const scores = Object.values(bestScores);
      const avgGrade = scores.length > 0
        ? scores.reduce((acc, curr) => acc + curr, 0) / scores.length
        : 0;
      
      // Ranking Score: Points weighted 40%, Grade weighted 60%
      // We normalize points (assuming 1000 is a high baseline) or just use a simple sum
      const rankingScore = (s.points * 0.5) + (avgGrade * 1.5);

      return {
        id: s.id,
        name: s.user.name,
        class: s.class?.name || 'Unassigned',
        points: s.points,
        avgGrade: Math.round(avgGrade),
        rankingScore: Math.round(rankingScore * 10) / 10
      };
    }).sort((a, b) => b.rankingScore - a.rankingScore).slice(0, 5);

    // ─── TEACHER PARTICIPATION ───────────────────────────────
    const rawTeachers = await prisma.teacher.findMany({
      include: {
        user: { select: { name: true, avatar: true } },
        _count: { select: { quizzes: true, assignments: true, liveClasses: true } }
      }
    });

    const teacherParticipation = rawTeachers.map(t => ({
      id: t.id,
      name: t.user.name,
      avatar: t.user.avatar,
      quizzes: t._count.quizzes,
      assignments: t._count.assignments,
      liveClasses: t._count.liveClasses,
      totalActivity: t._count.quizzes + t._count.assignments + t._count.liveClasses
    })).sort((a, b) => b.totalActivity - a.totalActivity);

    res.json({ 
      totalStudents, totalTeachers, totalClasses, totalSubjects, totalCourses, 
      recentUsers, activeUsers, upcomingClasses, settings, genderStats, 
      systemHealth, studentRankings, teacherParticipation 
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getRiskReport = async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: { select: { id: true, name: true, lastLogin: true, email: true } },
        class: { select: { name: true } },
        quizAttempts: { select: { score: true, strikes: true } }
      }
    });

    const report = students.map(s => {
      const avgScore = s.quizAttempts.length > 0 
        ? s.quizAttempts.reduce((acc, curr) => acc + curr.score, 0) / s.quizAttempts.length 
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

    // Sort by risk level
    const sortedReport = report.sort((a, b) => {
      const levels = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return levels[b.riskLevel] - levels[a.riskLevel];
    });

    res.json(sortedReport);
  } catch (err) {
    console.error('Risk report error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── USER MANAGEMENT ────────────────────────────────────
const getUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (role) where.role = role.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, role: true, isActive: true, gender: true, permissions: true, createdAt: true, lastLogin: true, student: { include: { class: true } }, teacher: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        student: {
          include: {
            class: {
              include: {
                subjects: true,
                courseClasses: { include: { course: { include: { subject: true } } } }
              }
            }
          }
        },
        teacher: {
          include: {
            courseTeachers: { include: { course: { include: { subject: true, courseClasses: { include: { class: true } } } } } }
          }
        }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get user details error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, classId, parentName, parentEmail, parentPhone, subjects, gender } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already exists.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = role.toUpperCase();

    // ACID: wrap user + profile creation in a single transaction
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, password: hashedPassword, role: userRole, gender: gender || null },
      });
      if (userRole === 'STUDENT') {
        await tx.student.create({
          data: { userId: created.id, classId: classId ? parseInt(classId) : null, parentName, parentEmail, parentPhone },
        });
      } else if (userRole === 'TEACHER') {
        await tx.teacher.create({
          data: { userId: created.id, subjects: subjects || null },
        });
      }
      return created;
    });

    res.status(201).json({ message: 'User created.', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, permissions, classId, parentName, parentEmail, parentPhone, subjects, gender } = req.body;
    const data = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role.toUpperCase();
    if (isActive !== undefined) data.isActive = isActive;
    if (permissions !== undefined) data.permissions = permissions;
    if (gender !== undefined) data.gender = gender || null;

    // ACID: wrap user + profile update in a single transaction
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: parseInt(id) }, data });

      if (updated.role === 'STUDENT' && (classId !== undefined || parentName !== undefined || parentEmail !== undefined || parentPhone !== undefined)) {
        await tx.student.upsert({
          where: { userId: parseInt(id) },
          update: {
            classId: classId !== undefined ? (classId ? parseInt(classId) : null) : undefined,
            parentName, parentEmail, parentPhone
          },
          create: { userId: parseInt(id), classId: classId ? parseInt(classId) : null, parentName, parentEmail, parentPhone },
        });
      }
      if (updated.role === 'TEACHER' && subjects !== undefined) {
        await tx.teacher.upsert({
          where: { userId: parseInt(id) },
          update: { subjects },
          create: { userId: parseInt(id), subjects },
        });
      }
      return updated;
    });

    res.json({ message: 'User updated.', user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password is required.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ 
      where: { id: parseInt(id) }, 
      data: { password: hashed, mustChangePassword: true } 
    });
    res.json({ message: 'Password reset successfully. User will be forced to change it on next login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── CLASS MANAGEMENT ───────────────────────────────────
const getClasses = async (req, res) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        subjects: true,
        _count: { select: { students: true, subjects: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const createClass = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required.' });
    const cls = await prisma.class.create({ data: { name, description } });
    res.status(201).json(cls);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const cls = await prisma.class.update({ where: { id: parseInt(id) }, data: { name, description } });
    res.json(cls);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteClass = async (req, res) => {
  try {
    await prisma.class.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Class deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── SUBJECT MANAGEMENT ────────────────────────────────
const getSubjects = async (req, res) => {
  try {
    const { classId } = req.query;
    const where = classId ? { classId: parseInt(classId) } : {};
    const subjects = await prisma.subject.findMany({ where, include: { class: true } });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, classId } = req.body;
    if (!name || !classId) return res.status(400).json({ error: 'Name and classId are required.' });
    const subject = await prisma.subject.create({ data: { name, classId: parseInt(classId) } });
    res.status(201).json(subject);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, classId } = req.body;
    const subject = await prisma.subject.update({
      where: { id: parseInt(id) },
      data: { name, classId: classId ? parseInt(classId) : undefined },
    });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteSubject = async (req, res) => {
  try {
    await prisma.subject.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Subject deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── COURSE MANAGEMENT ─────────────────────────────────
const getCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        subject: true,
        topics: true,
        courseClasses: { include: { class: true } },
        courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        _count: { select: { quizzes: true, assignments: true } }
      },
    });
    res.json(courses);
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createCourse = async (req, res) => {
  try {
    const { title, subjectId, classIds, teacherIds, classId, teacherId } = req.body;
    
    // Support both old single-value format and new array format
    const classIdArray = classIds || (classId ? [parseInt(classId)] : []);
    const teacherIdArray = teacherIds || (teacherId ? [parseInt(teacherId)] : []);
    
    if (!title || !subjectId || classIdArray.length === 0 || teacherIdArray.length === 0) {
      return res.status(400).json({ error: 'Title, subjectId, at least one class, and at least one teacher are required.' });
    }
    
    // Resolve teacher IDs (they may be user IDs or teacher profile IDs)
    const resolvedTeacherIds = [];
    for (const tId of teacherIdArray) {
      const teacherProfile = await prisma.teacher.findFirst({
        where: { OR: [{ id: parseInt(tId) }, { userId: parseInt(tId) }] }
      });
      if (teacherProfile) resolvedTeacherIds.push(teacherProfile.id);
    }
    
    if (resolvedTeacherIds.length === 0) {
      return res.status(400).json({ error: 'No valid teacher profiles found.' });
    }

    // Auto-assignment logic: Scan title and description for class names
    const allClasses = await prisma.class.findMany();
    const textToScan = `${title} ${req.body.description || ''}`.toUpperCase();
    const autoMatchedClassIds = [];
    for (const cls of allClasses) {
      const regex = new RegExp(`\\b${cls.name.toUpperCase()}\\b`, 'i');
      if (regex.test(textToScan)) {
        autoMatchedClassIds.push(cls.id);
      }
    }

    // If matches found in description, they replace the provided classIdArray
    const finalClassIds = autoMatchedClassIds.length > 0 ? autoMatchedClassIds : classIdArray;

    // ACID: wrap course + related mappings in a transaction
    const fullCourse = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title,
          description: req.body.description,
          subjectId: parseInt(subjectId),
        },
      });
      
      // Create many-to-many mappings
      for (const cId of finalClassIds) {
        await tx.courseClass.create({
          data: { courseId: course.id, classId: parseInt(cId) }
        });
      }
      for (const tId of resolvedTeacherIds) {
        await tx.courseTeacher.create({
          data: { courseId: course.id, teacherId: tId }
        });
      }
      
      return tx.course.findUnique({
        where: { id: course.id },
        include: {
          subject: true,
          courseClasses: { include: { class: true } },
          courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        }
      });
    });
    
    res.status(201).json(fullCourse);
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const courseId = parseInt(id);
    const { title, subjectId, classIds, teacherIds } = req.body;
    
    const data = {};
    if (title) data.title = title;
    if (subjectId) data.subjectId = parseInt(subjectId);
    
    // ACID: wrap course update + related mapping sync in a transaction
    const course = await prisma.$transaction(async (tx) => {
      await tx.course.update({ where: { id: courseId }, data });
      
      if (finalClassIds && finalClassIds.length > 0) {
        await tx.courseClass.deleteMany({ where: { courseId } });
        for (const cId of finalClassIds) {
          await tx.courseClass.create({ data: { courseId, classId: parseInt(cId) } });
        }
      }
      if (teacherIds && teacherIds.length > 0) {
        const resolvedIds = [];
        for (const tId of teacherIds) {
          const tp = await tx.teacher.findFirst({ where: { OR: [{ id: parseInt(tId) }, { userId: parseInt(tId) }] } });
          if (tp) resolvedIds.push(tp.id);
        }
        if (resolvedIds.length > 0) {
          await tx.courseTeacher.deleteMany({ where: { courseId } });
          for (const tId of resolvedIds) {
            await tx.courseTeacher.create({ data: { courseId, teacherId: tId } });
          }
        }
      }

      return tx.course.findUnique({
        where: { id: courseId },
        include: {
          subject: true,
          courseClasses: { include: { class: true } },
          courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        }
      });
    });
    res.json(course);
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({
      where: { id: parseInt(id) },
      include: {
        subject: true,
        courseClasses: { include: { class: true } },
        courseTeachers: { include: { teacher: { include: { user: { select: { name: true } } } } } },
        topics: {
          include: { materials: true },
          orderBy: { orderIndex: 'asc' }
        },
        _count: { select: { quizzes: true, assignments: true } }
      }
    });

    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Students enrolled across all assigned classes
    const assignedClassIds = course.courseClasses.map(cc => cc.classId);
    const studentsCount = await prisma.student.count({ 
      where: { classId: { in: assignedClassIds } } 
    });

    res.json({ ...course, studentsCount });
  } catch (err) {
    console.error('Get course by id error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── SETTINGS ───────────────────────────────────────────
const getSettings = async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const getPublicSettings = async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst({
      select: {
        schoolName: true,
        logo: true,
        primaryColor: true,
        secondaryColor: true,
        lockdownMode: true,
        welcomeMessage: true,
        supportEmail: true,
        supportPhone: true,
      }
    });
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settingsArr = await prisma.settings.findMany();
    const settings = settingsArr[0];
    if (!settings) return res.status(404).json({ error: 'Settings not found.' });
    
    const { 
      schoolName, academicYear, term, primaryColor, secondaryColor, lockdownMode, defaultTheme, allowRegistration, welcomeMessage,
      supportEmail, supportPhone, passingGrade, gradingSystem, maxUploadSize, enableMessaging, adminPassword, logo
    } = req.body;

    // Security: If changing lockdown mode, strictly verify the maintenance password
    if (lockdownMode !== undefined && lockdownMode !== settings.lockdownMode) {
      if (!adminPassword) {
        return res.status(400).json({ error: 'Maintenance password is required.' });
      }
      
      if (adminPassword !== (process.env.MAINTENANCE_PASSWORD || 'Onereal22')) {
        return res.status(400).json({ error: 'Authentication failed: Incorrect maintenance password.' });
      }
    }
    
    const updated = await prisma.settings.update({
      where: { id: settings.id },
      data: { 
        schoolName, academicYear, term, primaryColor, secondaryColor, lockdownMode, defaultTheme, allowRegistration, welcomeMessage,
        supportEmail, supportPhone, logo,
        passingGrade: parseInt(passingGrade) || 50,
        gradingSystem,
        maxUploadSize: parseInt(maxUploadSize) || 5,
        enableMessaging
      },
    });

    // Broadcast updated settings to all connected clients
    const wss = req.app.get('wss');
    if (wss) {
      const broadcastMsg = JSON.stringify({ type: 'SETTINGS_UPDATED', payload: updated });
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
          client.send(broadcastMsg);
        }
      });
    }

    res.json(updated);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const settingsArr = await prisma.settings.findMany();
    const settings = settingsArr[0];
    if (!settings) return res.status(404).json({ error: 'Settings not found.' });

    const logoUrl = `/uploads/branding/${req.file.filename}`;

    const updated = await prisma.settings.update({
      where: { id: settings.id },
      data: { logo: logoUrl },
    });

    // Broadcast updated settings to all connected clients
    const wss = req.app.get('wss');
    if (wss) {
      const broadcastMsg = JSON.stringify({ type: 'SETTINGS_UPDATED', payload: updated });
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // 1 = OPEN
          client.send(broadcastMsg);
        }
      });
    }

    res.json({ logo: logoUrl, settings: updated });
  } catch (err) {
    console.error('Upload logo error:', err);
    res.status(500).json({ error: 'Server error during logo upload.' });
  }
};

const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

    res.json({ success: true, message: 'Password verified' });
  } catch (err) {
    console.error('Verify password error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── ANALYTICS ──────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const totalEnrollments = await prisma.student.count();
    const coursesActive = await prisma.course.count();
    
    const avgScoreData = await prisma.quizAttempt.aggregate({
      _avg: { score: true }
    });
    const avgGrade = (avgScoreData._avg?.score || 0).toFixed(1);

    const attempts = await prisma.quizAttempt.findMany({ select: { score: true } });
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

    const subjects = await prisma.subject.findMany({});
    const studentPerformance = subjects.map(s => ({ subject: s.name.substring(0, 10), score: 0 }));

    const teachers = await prisma.teacher.findMany({
      include: {
        user: { select: { name: true } },
        courseTeachers: true,
        quizzes: true,
      }
    });
    const teacherActivity = teachers.map(t => ({
      name: t.user?.name || 'Unknown',
      classes: t.courseTeachers.length,
      quizzes: t.quizzes.length,
      lessons: 0,
      students: 0
    }));

    const enrollmentTrend = [
      { month: 'Oct', students: totalEnrollments > 0 ? totalEnrollments - 5 : 0 },
      { month: 'Nov', students: totalEnrollments > 0 ? totalEnrollments - 3 : 0 },
      { month: 'Dec', students: totalEnrollments > 0 ? totalEnrollments - 2 : 0 },
      { month: 'Jan', students: totalEnrollments > 0 ? totalEnrollments - 1 : 0 },
      { month: 'Feb', students: totalEnrollments },
      { month: 'Mar', students: totalEnrollments },
    ];

    res.json({
      statCards: {
        totalEnrollments,
        coursesActive,
        avgGrade: `${avgGrade}%`,
        completionRate: 'N/A'
      },
      studentPerformance: studentPerformance.length > 0 ? studentPerformance : [{ subject: 'No Subjects', score: 0 }],
      enrollmentTrend,
      gradeDistribution,
      teacherActivity
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── BULK OPERATIONS ────────────────────────────────────
const bulkUploadUsers = async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) return res.status(400).json({ error: 'Invalid data format. Expected an array of users.' });

    let successCount = 0;
    const failedRows = [];

    // Pre-fetch all classes and courses to minimize DB queries inside the loop
    const allDBClasses = await prisma.class.findMany({ select: { id: true, name: true } });
    const allDBCourses = await prisma.course.findMany({ 
      include: { courseClasses: { include: { class: { select: { id: true, name: true } } } } }
    });

    for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const rowNum = i + 2; // +1 for 0-index, +1 for header row
        
        let { first_name, last_name, email, phone, gender, role, class: clsName, course, password } = u;
        email = email?.toString().trim();
        first_name = first_name?.toString().trim();
        last_name = last_name?.toString().trim();
        role = role?.toString().toUpperCase().trim();
        gender = gender?.toString().toUpperCase().trim();
        
        if (gender && !['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
            failedRows.push({ row: rowNum, email, reason: `Invalid gender: ${gender}. Must be MALE, FEMALE, or OTHER.` });
            continue;
        }
        
        if (!email || !first_name || !last_name || !role) {
            failedRows.push({ row: rowNum, email, reason: 'Missing required fields (first_name, last_name, email, or role).' });
            continue;
        }

        if (!['STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
            failedRows.push({ row: rowNum, email, reason: `Invalid role: ${role}. Must be student, teacher, or admin.` });
            continue;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            failedRows.push({ row: rowNum, email, reason: 'Email already exists in the system.' });
            continue;
        }
        
        // --- STUDENT LOGIC ---
        let clsIdToAssign = null;
        if (role === 'STUDENT') {
            if (!clsName) {
                 failedRows.push({ row: rowNum, email, reason: 'Students must have a class specified.' });
                 continue;
            }
            if (clsName.toString().includes(',')) {
                 failedRows.push({ row: rowNum, email, reason: 'Students must be assigned to ONE class only.' });
                 continue;
            }
            const foundClass = allDBClasses.find(c => c.name.toLowerCase() === clsName.toString().trim().toLowerCase());
            if (!foundClass) {
                 failedRows.push({ row: rowNum, email, reason: `Class '${clsName}' not found in database.` });
                 continue;
            }
            clsIdToAssign = foundClass.id;
        }

        // --- TEACHER LOGIC ---
        let teacherCourses = [];
        if (role === 'TEACHER') {
             if (clsName && clsName.toString().trim() !== '') {
                 const clsNames = clsName.toString().split(',').map(n => n.trim().toLowerCase());
                 let clsNotFound = false;
                 for (const cName of clsNames) {
                     if (!allDBClasses.some(c => c.name.toLowerCase() === cName)) {
                         failedRows.push({ row: rowNum, email, reason: `Class '${cName}' not found in database.` });
                         clsNotFound = true;
                         break;
                     }
                 }
                 if (clsNotFound) continue;
             }

             if (course && course.toString().trim() !== '') {
                 const courseNames = course.toString().split(',').map(n => n.trim().toLowerCase());
                 let crsNotFound = false;
                 for (const cName of courseNames) {
                     const f = allDBCourses.find(c => c.title.toLowerCase() === cName);
                     if (f) teacherCourses.push(f);
                     else {
                         failedRows.push({ row: rowNum, email, reason: `Course '${cName}' not found.` });
                         crsNotFound = true;
                         break;
                     }
                 }
                 if (crsNotFound) continue;
             }
        }

        // --- INSERTION ---
        try {
            const pwd = password ? password.toString() : '123456';
            const hashedPassword = await bcrypt.hash(pwd, 12);
            
            const newUser = await prisma.user.create({
              data: { 
                name: `${first_name} ${last_name}`, 
                email, 
                password: hashedPassword, 
                role: role === 'ADMIN' ? 'SUPER_ADMIN' : role,
                gender: gender || null
              },
            });

            if (role === 'STUDENT') {
              await prisma.student.create({ data: { userId: newUser.id, classId: clsIdToAssign } });
            } 
            else if (role === 'TEACHER') {
              const teacherRec = await prisma.teacher.create({ data: { userId: newUser.id } });
              
              const uniqueCourseIds = Array.from(new Set(teacherCourses.map(c => c.id)));
              for (const cId of uniqueCourseIds) {
                  await prisma.courseTeacher.create({
                      data: { courseId: cId, teacherId: teacherRec.id }
                  });
              }
            }
            successCount++;
        } catch (dbErr) {
            failedRows.push({ row: rowNum, email, reason: 'Database insertion error.' });
        }
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Bulk Upload Users', details: `Succeeded: ${successCount}. Failed: ${failedRows.length}` }
    });

    res.json({ successCount, failedRows, totalRows: users.length });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── AUDIT LOGS ─────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── SYSTEM HEALTH ────────────────────────────
const getSystemHealth = async (req, res) => {
  try {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    res.json({
      uptime,
      memory: { rss: memory.rss, heapTotal: memory.heapTotal, heapUsed: memory.heapUsed },
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── QUIZ MANAGEMENT (Admin view) ──────────────────────
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        course: { include: { courseClasses: { include: { class: true } }, subject: true } },
        creator: { include: { user: { select: { name: true } } } },
        _count: { select: { quizQuestions: true, quizAttempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quizzes);
  } catch (err) {
    console.error('Get quizzes error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id) },
      include: {
        course: { include: { courseClasses: { include: { class: true } }, subject: true } },
        creator: { include: { user: { select: { name: true } } } },
        quizQuestions: {
          include: { options: true }
        },
        quizClasses: true,
        _count: { select: { quizAttempts: true } },
      },
    });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    res.json(quiz);
  } catch (err) {
    console.error('Get quiz by id error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const exportQuizToWord = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        quizQuestions: { include: { options: true } },
        course: { include: { subject: true } },
        quizClasses: { include: { class: true } }
      }
    });

    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    
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
            children: [ new TextRun({ text: `Class: ${quiz.quizClasses?.[0]?.class?.name || 'Unknown'}`, size: 24, italics: true }) ],
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
    console.error('Export quiz to docx error', err);
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
    console.error('Export quiz to CSV error', err);
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

    if (results.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    await prisma.$transaction(async (tx) => {
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

    try { fs.unlinkSync(req.file.path); } catch (e) {}

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Import Quiz CSV', details: `Admin imported ${results.length} questions for quiz ${quizId}` }
    });

    res.json({ message: 'Quiz questions imported successfully!', count: results.length });
  } catch (err) {
    console.error('Import quiz CSV error', err);
    res.status(500).json({ error: 'Server error while importing CSV.' });
  }
};

const createQuiz = async (req, res) => {
  try {
    const { title, courseId, creatorId, timeLimit, attemptLimit, questions, classIds } = req.body;
    
    let tid = creatorId;
    if (!tid) {
      const teacher = await prisma.teacher.findFirst();
      if (!teacher) return res.status(400).json({ error: 'No teachers available to assign quiz to.' });
      tid = teacher.id;
    }
    
    // Validate questions if provided
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText) {
          return res.status(400).json({ error: `Question ${i + 1}: Question text is required.` });
        }
        if (!q.options || q.options.length !== 4) {
          return res.status(400).json({ error: `Question ${i + 1}: Exactly 4 options (A-D) are required.` });
        }
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          return res.status(400).json({ error: `Question ${i + 1}: Exactly one correct answer is required.` });
        }
        for (const opt of q.options) {
          if (!opt.optionText || !opt.optionText.trim()) {
            return res.status(400).json({ error: `Question ${i + 1}: All option texts must be filled.` });
          }
        }
      }
    }
    
    const fullQuiz = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: { 
          title, 
          duration: parseInt(timeLimit) || 30,
          attemptLimit: parseInt(attemptLimit) || 1,
          courseId: parseInt(courseId), 
          createdBy: parseInt(tid),
        }
      });
      
      if (classIds && Array.isArray(classIds)) {
        for (const cid of classIds) {
          await tx.quizClass.create({
            data: { quizId: quiz.id, classId: parseInt(cid) }
          });
        }
      }

      // Create questions and options
      if (questions && questions.length > 0) {
        for (const q of questions) {
          const question = await tx.quizQuestion.create({
            data: {
              quizId: quiz.id,
              questionText: q.questionText,
              points: q.points || 1,
            }
          });
          for (const opt of q.options) {
            await tx.quizOption.create({
              data: {
                questionId: question.id,
                optionLabel: opt.optionLabel,
                optionText: opt.optionText,
                isCorrect: opt.isCorrect || false,
              }
            });
          }
        }
      }

      const fetched = await tx.quiz.findUnique({
        where: { id: quiz.id },
        include: {
          quizQuestions: { include: { options: true } },
          course: { include: { courseClasses: { include: { class: true } }, subject: true } },
          creator: { include: { user: { select: { name: true } } } },
          quizClasses: true,
        }
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
        data: { userId: req.user.id, action: 'Create Quiz', details: `Admin created quiz ${quiz.id} with ${questions?.length || 0} questions` }
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
    const { id } = req.params;
    const quizId = parseInt(id);
    const { title, courseId, timeLimit, attemptLimit, isPublished, questions, classIds } = req.body;
    
    const data = {};
    if (title) data.title = title;
    if (courseId) data.courseId = parseInt(courseId);
    if (timeLimit) data.duration = parseInt(timeLimit);
    if (attemptLimit !== undefined) data.attemptLimit = parseInt(attemptLimit);
    if (isPublished !== undefined) data.isPublished = isPublished;
    
    // If questions are provided, validate
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText) {
          return res.status(400).json({ error: `Question ${i + 1}: Question text is required.` });
        }
        if (!q.options || q.options.length !== 4) {
          return res.status(400).json({ error: `Question ${i + 1}: Exactly 4 options (A-D) are required.` });
        }
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
          return res.status(400).json({ error: `Question ${i + 1}: Exactly one correct answer is required.` });
        }
      }
    }

    const fullQuiz = await prisma.$transaction(async (tx) => {
      await tx.quiz.update({ where: { id: quizId }, data });
      
      if (classIds && Array.isArray(classIds)) {
        await tx.quizClass.deleteMany({ where: { quizId } });
        for (const cid of classIds) {
          await tx.quizClass.create({
            data: { quizId, classId: parseInt(cid) }
          });
        }
      }
      
      // If questions are provided, replace all existing questions
      if (questions && questions.length > 0) {
        // Delete existing questions (cascades to options)
        await tx.quizQuestion.deleteMany({ where: { quizId } });
        
        // Recreate
        for (const q of questions) {
          const question = await tx.quizQuestion.create({
            data: { quizId, questionText: q.questionText, points: q.points || 1 }
          });
          for (const opt of q.options) {
            await tx.quizOption.create({
              data: {
                questionId: question.id,
                optionLabel: opt.optionLabel,
                optionText: opt.optionText,
                isCorrect: opt.isCorrect || false,
              }
            });
          }
        }
      }

      return tx.quiz.findUnique({
        where: { id: quizId },
        include: {
          quizQuestions: { include: { options: true } },
          course: { include: { courseClasses: { include: { class: true } }, subject: true } },
          creator: { include: { user: { select: { name: true } } } },
          quizClasses: true,
        }
      });
    });
    
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Update Quiz', details: `Admin updated quiz ${quizId}` }
    });
    res.json(fullQuiz);
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.quiz.delete({ where: { id: parseInt(id) } });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Delete Quiz', details: `Admin deleted quiz ${id}` }
    });
    res.json({ message: 'Quiz deleted successfully.' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── ASSIGNMENT MANAGEMENT (Admin view) ─────────────────
const getAssignments = async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany({
      include: {
        course: { include: { courseClasses: { include: { class: true } }, subject: true } },
        creator: { include: { user: { select: { name: true } } } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assignments);
  } catch (err) {
    console.error('Get assignments error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── NOTIFICATIONS / ANNOUNCEMENTS ─────────────────────
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { isGlobal: true },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createNotification = async (req, res) => {
  try {
    const { title, message, type, target } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required.' });
    
    const notification = await prisma.notification.create({
      data: {
        userId: req.user.id, // Creator
        title,
        message,
        type: type || 'ANNOUNCEMENT',
        isGlobal: true,
        targetRole: target || 'all',
      },
    });
    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    await prisma.notification.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Notification deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── LIVE CLASSES (Admin view) ──────────────────────────
const getLiveClasses = async (req, res) => {
  try {
    const classes = await prisma.liveClass.findMany({
      include: {
        class: true,
        teacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduleDate: 'desc' },
    });
    res.json(classes);
  } catch (err) {
    console.error('Get live classes error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GRADEBOOK (Admin view) ────────────────────────────
const getGradebook = async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
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
    console.error('Get gradebook error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── MATERIALS (Resource Library) ────────────────────────
const getMaterials = async (req, res) => {
  try {
    const materials = await prisma.material.findMany({
      include: {
        topic: { include: { course: { include: { subject: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(materials);
  } catch (err) {
    console.error('Get materials error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createMaterial = async (req, res) => {
  try {
    const { title, type, fileUrl, externalUrl, topicId, textContent, isGlobal, description } = req.body;

    let finalPath = '';
    let finalTitle = title;
    let finalType = type || 'DOCUMENT';

    if (req.file) {
      // Physical file uploaded via multer
      finalPath = req.file.path;
      finalTitle = finalTitle || req.file.originalname;
      const ext = require('path').extname(req.file.originalname).toLowerCase();
      if (['.pdf'].includes(ext)) finalType = 'PDF';
      else if (['.mp4', '.webm', '.avi'].includes(ext)) finalType = 'VIDEO';
      else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) finalType = 'IMAGE';
      else if (['.doc', '.docx'].includes(ext)) finalType = 'WORD';
    } else if (textContent) {
      finalType = 'TEXT';
      finalPath = 'text-content';
    } else if (externalUrl || fileUrl) {
      finalPath = externalUrl || fileUrl;
      if (finalPath.includes('youtube.com') || finalPath.includes('youtu.be') || finalPath.includes('vimeo.com')) {
        finalType = 'VIDEO';
      }
    } else {
      return res.status(400).json({ error: 'No content provided (file, URL, or text).' });
    }

    const globalFlag = isGlobal === 'true' || isGlobal === true;

    const material = await prisma.material.create({
      data: {
        fileName: finalTitle || 'Untitled',
        filePath: finalPath,
        type: finalType,
        topicId: globalFlag ? null : parseInt(topicId),
        isGlobal: globalFlag,
        description: description || null,
        textContent: textContent || null,
        uploadedBy: req.user.id
      }
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Create Material', details: `Admin created material ${material.id}` }
    });
    res.status(201).json(material);
  } catch (err) {
    console.error('Create material error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, fileUrl, externalUrl, isEmbed, topicId, textContent, isGlobal, description } = req.body;
    
    let dbUpdate = {
        fileName: title, 
        filePath: fileUrl || externalUrl || undefined, 
        description: description !== undefined ? description : undefined,
        type: type || undefined, 
        textContent: textContent !== undefined ? textContent : undefined
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
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'Update Material', details: `Admin updated material ${material.id}` }
    });
    res.json(material);
  } catch (err) {
    console.error('Update material error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.material.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Material deleted' });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── EXPORT USERS (Excel) ───────────────────────────────
const exportUsers = async (req, res) => {
  try {
    const { role, status, classId } = req.query;
    const where = {};
    if (role && role !== 'all') where.role = role.toUpperCase();
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (classId && role !== 'teacher') {
      where.student = { classId: parseInt(classId) };
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          include: {
            class: { include: { subjects: true } }
          }
        },
        teacher: {
          include: {
            courseTeachers: { include: { course: { include: { subject: true, courseClasses: { include: { class: true } } } } } }
          }
        }
      }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ONEREAL LMS';
    workbook.created = new Date();

    // ── STUDENTS SHEET ──
    const studentSheet = workbook.addWorksheet('Students', { properties: { tabColor: { argb: '7C3AED' } } });
    studentSheet.columns = [
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Class', key: 'class', width: 18 },
      { header: 'Enrolled Subjects', key: 'subjects', width: 50 },
      { header: 'Parent Name', key: 'parentName', width: 22 },
      { header: 'Parent Email', key: 'parentEmail', width: 30 },
      { header: 'Parent Phone', key: 'parentPhone', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date Joined', key: 'createdAt', width: 18 },
    ];
    // Style header row
    studentSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    studentSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } };

    // ── TEACHERS SHEET ──
    const teacherSheet = workbook.addWorksheet('Teachers', { properties: { tabColor: { argb: '0EA5E9' } } });
    teacherSheet.columns = [
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Assigned Subjects', key: 'subjects', width: 50 },
      { header: 'Classes Covered', key: 'classes', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date Joined', key: 'createdAt', width: 18 },
    ];
    teacherSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    teacherSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0EA5E9' } };

    // ── ADMINS SHEET ──
    const adminSheet = workbook.addWorksheet('Admins', { properties: { tabColor: { argb: 'F59E0B' } } });
    adminSheet.columns = [
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Date Joined', key: 'createdAt', width: 18 },
    ];
    adminSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    adminSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } };

    for (const u of users) {
      const username = u.email.split('@')[0];
      const status = u.isActive ? 'Active' : 'Inactive';
      const joined = new Date(u.createdAt).toLocaleDateString();

      if (u.role === 'STUDENT') {
        const className = u.student?.class?.name || 'Not Assigned';
        const subjectNames = (u.student?.class?.subjects || []).map(s => s.name).join(', ') || 'None';
        studentSheet.addRow({
          name: u.name, username, email: u.email,
          class: className, subjects: subjectNames,
          parentName: u.student?.parentName || '',
          parentEmail: u.student?.parentEmail || '',
          parentPhone: u.student?.parentPhone || '',
          status, createdAt: joined,
        });
      } else if (u.role === 'TEACHER') {
        const courses = u.teacher?.courseTeachers?.map(ct => ct.course) || [];
        const subjectNames = courses.map(c => c.subject?.name || c.title).join(', ') || 'None';
        const classNames = [...new Set(courses.flatMap(c => c.courseClasses?.map(cc => cc.class?.name) || []))].join(', ') || 'None';
        teacherSheet.addRow({
          name: u.name, username, email: u.email,
          subjects: subjectNames, classes: classNames,
          status, createdAt: joined,
        });
      } else {
        adminSheet.addRow({ name: u.name, username, email: u.email, status, createdAt: joined });
      }
    }

    // Alternate row colors for readability
    [studentSheet, teacherSheet, adminSheet].forEach(ws => {
      ws.eachRow((row, rowNum) => {
        if (rowNum > 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNum % 2 === 0 ? 'F5F3FF' : 'FFFFFF' } };
            cell.border = { bottom: { style: 'thin', color: { argb: 'E5E7EB' } } };
          });
        }
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="users_export_${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ error: 'Server error during export.' });
  }
};

const archivesDir = path.join(__dirname, '../../archives');
if (!fs.existsSync(archivesDir)) {
  fs.mkdirSync(archivesDir, { recursive: true });
}

const getBackups = async (req, res) => {
  try {
    const files = fs.readdirSync(archivesDir).filter(f => f.endsWith('.tar.gz'));
    const backups = files.map(file => {
      const stats = fs.statSync(path.join(archivesDir, file));
      return {
        filename: file,
        size: stats.size,
        createdAt: stats.birthtime,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(backups);
  } catch (err) {
    console.error('Get backups error:', err);
    res.status(500).json({ error: 'Failed to read backups.' });
  }
};

const createBackup = async (req, res) => {
  try {
    const backupName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
    const tempPath = path.join(archivesDir, backupName);
    
    const projectRoot = path.join(__dirname, '../../');
    const cmd = `tar -czvf "archives/${backupName}" prisma/dev.db uploads`;

    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error && !fs.existsSync(tempPath)) {
        console.error('Backup error:', error);
        return res.status(500).json({ error: 'Failed to create backup archive.' });
      }

      // Enforce max 5 backups natively
      const files = fs.readdirSync(archivesDir).filter(f => f.endsWith('.tar.gz'));
      if (files.length > 5) {
        const sorted = files.map(file => ({ file, time: fs.statSync(path.join(archivesDir, file)).birthtime.getTime() }))
                            .sort((a, b) => a.time - b.time);
        const toDelete = sorted.slice(0, sorted.length - 5);
        for (const { file } of toDelete) {
          try { fs.unlinkSync(path.join(archivesDir, file)); } catch(e){}
        }
      }

      res.json({ message: 'Backup created successfully.', filename: backupName });
    });
  } catch (err) {
    console.error('Create backup exception:', err);
    res.status(500).json({ error: 'Internal server error during backup.' });
  }
};

const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(archivesDir, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }
    res.download(filepath, filename);
  } catch (err) {
    console.error('Download backup exception:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const restoreBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(archivesDir, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }

    const projectRoot = path.join(__dirname, '../../');
    const cmd = `tar -xzvf "archives/${filename}"`;

    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error('Restore error:', error);
        return res.status(500).json({ error: 'Failed to restore backup archive.' });
      }

      res.json({ message: 'Backup restored successfully. Changes applied.' });
    });
  } catch (err) {
    console.error('Restore backup exception:', err);
    res.status(500).json({ error: 'Internal server error during restore.' });
  }
};

const uploadRestoreBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file uploaded.' });
    }
    const uploadedPath = req.file.path; // multer puts it inside uploads/
    const projectRoot = path.join(__dirname, '../../');
    const cmd = `tar -xzvf "${uploadedPath}"`;

    exec(cmd, { cwd: projectRoot }, (error, stdout, stderr) => {
      try { fs.unlinkSync(path.join(process.cwd(), uploadedPath)); } catch(e) {}
      if (error) {
        console.error('Uploaded Restore error:', error);
        return res.status(500).json({ error: 'Failed to restore from uploaded backup.' });
      }
      res.json({ message: 'Backup from upload was successfully restored!' });
    });
  } catch (err) {
    console.error('Upload Restore exception:', err);
    res.status(500).json({ error: 'Internal server error during upload restore.' });
  }
};

const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(archivesDir, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }
    fs.unlinkSync(filepath);
    res.json({ message: 'Backup deleted successfully.' });
  } catch (err) {
    console.error('Delete backup exception:', err);
    res.status(500).json({ error: 'Internal server error during deletion.' });
  }
};

const deleteAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.auditLog.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Audit log entry deleted.' });
  } catch (err) {
    console.error('Delete audit log exception:', err);
    res.status(500).json({ error: 'Internal server error during deletion.' });
  }
};

module.exports = {
  getDashboard, getUsers, getUserDetails, createUser, updateUser, deleteUser, resetPassword, exportUsers,
  getClasses, createClass, updateClass, deleteClass,
  getSubjects, createSubject, updateSubject, deleteSubject,
  getCourses, createCourse, updateCourse, deleteCourse, getCourseById,
  getSettings, updateSettings, getAnalytics,
  bulkUploadUsers, getAuditLogs, getSystemHealth,
  getQuizzes, getQuizById, exportQuizToWord, exportQuizToCSV, importQuizFromCSV, createQuiz, updateQuiz, deleteQuiz,
  getAssignments,
  getNotifications, createNotification, deleteNotification,
  getLiveClasses, getGradebook, 
  getMaterials, createMaterial, updateMaterial, deleteMaterial,
  getRiskReport, downloadBackup, getBackups, createBackup, restoreBackup, uploadRestoreBackup, deleteBackup,
  verifyPassword, getPublicSettings, deleteAuditLog, uploadLogo
};
