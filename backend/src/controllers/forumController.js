const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get categories (Subjects) accessible to user
const getCategories = async (req, res) => {
  try {
    const { user } = req;
    let subjects = [];

    if (user.role === 'admin' || user.role === 'super_admin') {
      subjects = await prisma.subject.findMany({
        include: { _count: { select: { forumThreads: true } } }
      });
    } else if (user.role === 'teacher') {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: user.id },
        include: { courseTeachers: { include: { course: { include: { subject: true } } } } }
      });
      const subjectMap = new Map();
      teacher.courseTeachers.forEach(ct => {
        if (ct.course.subject) subjectMap.set(ct.course.subjectId, ct.course.subject);
      });
      subjects = Array.from(subjectMap.values());
    } else if (user.role === 'student') {
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
        include: { studentClasses: { include: { class: { include: { courses: { include: { subject: true } } } } } } }
      });
      const subjectMap = new Map();
      student.studentClasses.forEach(sc => {
        sc.class.courses.forEach(c => {
          if (c.subject) subjectMap.set(c.subjectId, c.subject);
        });
      });
      subjects = Array.from(subjectMap.values());
    }

    // Include thread counts for UI
    const finalSubjects = await Promise.all(subjects.map(async (subj) => {
      const count = await prisma.forumThread.count({ where: { categoryId: subj.id } });
      return { ...subj, threadCount: count };
    }));

    res.json(finalSubjects);
  } catch (err) {
    console.error('getCategories err:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getThreads = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const threads = await prisma.forumThread.findMany({
      where: { categoryId },
      include: {
        author: { select: { id: true, name: true, role: true, profileImage: true } },
        _count: { select: { posts: true } }
      },
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createThread = async (req, res) => {
  try {
    const { title, content } = req.body;
    const categoryId = parseInt(req.params.categoryId);
    
    // Limits logic - if student, limit to 3 topics per day
    if (req.user.role === 'student') {
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const threadCount = await prisma.forumThread.count({
          where: {
            authorId: req.user.id,
            createdAt: { gte: today }
          }
       });
       if (threadCount >= 3) {
         return res.status(403).json({ error: "Daily limit reached. Students can only create 3 topics per day." });
       }
    }

    const thread = await prisma.forumThread.create({
      data: {
        title,
        content,
        authorId: req.user.id,
        categoryId
      },
      include: {
        author: { select: { id: true, name: true, role: true, profileImage: true } },
        _count: { select: { posts: true } }
      }
    });
    // Award Community Voice badge for first thread
    if (req.user.role === 'student') {
      const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
      if (student) {
        const existing = await prisma.achievement.findFirst({
          where: { studentId: student.id, badge: 'community_voice' }
        });
        if (!existing) {
          await prisma.achievement.create({
            data: {
              studentId: student.id,
              userId: req.user.id,
              title: 'Community Voice',
              description: 'Created your first discussion topic!',
              points: 30,
              badge: 'community_voice'
            }
          });
        }
      }
    }

    res.json(thread);
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getThreadDetails = async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    const thread = await prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        author: { select: { id: true, name: true, role: true, profileImage: true } },
        posts: {
          include: { author: { select: { id: true, name: true, role: true, profileImage: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    res.json(thread);
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateThread = async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    const { isPinned, isLocked } = req.body;
    
    const canManage = ['teacher', 'admin', 'super_admin'].includes(req.user.role);
    if (!canManage) return res.status(403).json({ error: 'Not authorized to moderate threads' });

    const thread = await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned, isLocked }
    });
    res.json(thread);
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteThread = async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ error: 'Not found' });

    const canManage = ['teacher', 'admin', 'super_admin'].includes(req.user.role) || thread.authorId === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Not authorized' });

    await prisma.forumPost.deleteMany({ where: { threadId } });
    await prisma.forumThread.delete({ where: { id: threadId } });
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createPost = async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    const { content } = req.body;

    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.isLocked && req.user.role === 'student') {
      return res.status(403).json({ error: 'Thread is locked from new replies' });
    }

    const post = await prisma.forumPost.create({
      data: {
        content,
        authorId: req.user.id,
        threadId
      },
      include: {
        author: { select: { id: true, name: true, role: true, profileImage: true } }
      }
    });
    
    // Update thread updatedAt
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });
    
    // Award Helping Hand badge for first reply
    if (req.user.role === 'student') {
       const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
       if (student) {
          const existing = await prisma.achievement.findFirst({
            where: { studentId: student.id, badge: 'helping_hand' }
          });
          if (!existing) {
            await prisma.achievement.create({
              data: {
                studentId: student.id,
                userId: req.user.id,
                title: 'Helping Hand',
                description: 'Replied to a discussion for the first time!',
                points: 20,
                badge: 'helping_hand'
              }
            });
          }
       }
    }

    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: 'Not found' });

    const canManage = ['teacher', 'admin', 'super_admin'].includes(req.user.role) || post.authorId === req.user.id;
    if (!canManage) return res.status(403).json({ error: 'Not authorized' });

    await prisma.forumPost.delete({ where: { id: postId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getCategories, getThreads, createThread, getThreadDetails, updateThread, deleteThread, createPost, deletePost
};
