const prisma = require('../config/prisma');

const getCalendarEvents = async (req, res) => {
  try {
    const role = req.user.role ? req.user.role.toUpperCase() : '';
    const userId = req.user.id;

    let assignments = [];
    let quizzes = [];
    let liveClasses = [];

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      // Admin gets everything
      assignments = await prisma.assignment.findMany({
        include: {
          course: {
            select: {
              title: true,
              subject: { select: { name: true } }
            }
          }
        }
      });

      quizzes = await prisma.quiz.findMany({
        include: {
          course: {
            select: {
              title: true,
              subject: { select: { name: true } }
            }
          }
        }
      });

      liveClasses = await prisma.liveClass.findMany({
        include: {
          teacher: {
            include: {
              user: { select: { name: true } }
            }
          },
          class: { select: { name: true } }
        }
      });

    } else if (role === 'TEACHER') {
      // Find teacher profile
      const teacher = await prisma.teacher.findUnique({
        where: { userId }
      });

      if (teacher) {
        assignments = await prisma.assignment.findMany({
          where: { createdBy: teacher.id },
          include: {
            course: {
              select: {
                title: true,
                subject: { select: { name: true } }
              }
            }
          }
        });

        quizzes = await prisma.quiz.findMany({
          where: { createdBy: teacher.id },
          include: {
            course: {
              select: {
                title: true,
                subject: { select: { name: true } }
              }
            }
          }
        });

        liveClasses = await prisma.liveClass.findMany({
          where: { teacherId: teacher.id },
          include: {
            class: { select: { name: true } }
          }
        });
      }

    } else if (role === 'STUDENT') {
      // Find student profile
      const student = await prisma.student.findUnique({
        where: { userId }
      });

      if (student && student.classId) {
        const classId = student.classId;

        assignments = await prisma.assignment.findMany({
          where: {
            assignmentClasses: {
              some: { classId }
            }
          },
          include: {
            course: {
              select: {
                title: true,
                subject: { select: { name: true } }
              }
            }
          }
        });

        quizzes = await prisma.quiz.findMany({
          where: {
            isPublished: true,
            quizClasses: {
              some: { classId }
            }
          },
          include: {
            course: {
              select: {
                title: true,
                subject: { select: { name: true } }
              }
            }
          }
        });

        liveClasses = await prisma.liveClass.findMany({
          where: { classId },
          include: {
            teacher: {
              include: {
                user: { select: { name: true } }
              }
            }
          }
        });
      }
    }

    // Map each list to a unified event format
    const events = [
      ...assignments.map(a => ({
        id: `assignment-${a.id}`,
        dbId: a.id,
        type: 'assignment',
        title: a.title,
        description: a.description || 'No description provided.',
        date: a.deadline,
        courseTitle: a.course?.title || 'General',
        subjectName: a.course?.subject?.name || 'LMS',
        maxScore: a.maxScore
      })),
      ...quizzes.map(q => ({
        id: `quiz-${q.id}`,
        dbId: q.id,
        type: 'quiz',
        title: q.title,
        description: `Attempts limit: ${q.attemptLimit}. Duration: ${q.duration} mins.`,
        date: q.dueDate || q.createdAt, // fallback to creation if due date is not set
        dueDateSet: !!q.dueDate,
        courseTitle: q.course?.title || 'General',
        subjectName: q.course?.subject?.name || 'LMS',
        duration: q.duration,
        attemptLimit: q.attemptLimit
      })),
      ...liveClasses.map(lc => {
        // Parse the date and schedule time to a single date object
        const dateStr = lc.scheduleDate.toISOString().split('T')[0];
        const combinedDateTimeStr = `${dateStr}T${lc.scheduleTime || '00:00'}:00`;
        let combinedDate = new Date(combinedDateTimeStr);
        if (isNaN(combinedDate.getTime())) {
          combinedDate = lc.scheduleDate;
        }

        return {
          id: `liveclass-${lc.id}`,
          dbId: lc.id,
          type: 'live-class',
          title: lc.title,
          description: `Live lecture hosted by ${lc.teacher?.user?.name || 'Instructor'}. Duration: ${lc.duration} mins.`,
          date: combinedDate,
          googleMeetLink: lc.googleMeetLink,
          teacherName: lc.teacher?.user?.name || 'Instructor',
          className: lc.class?.name || 'Assigned Class'
        };
      })
    ];

    // Sort events by date ascending
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(events);
  } catch (err) {
    console.error('Get calendar events error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getCalendarEvents
};
