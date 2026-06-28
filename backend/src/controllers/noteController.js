const prisma = require('../config/prisma');

const getNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role; // e.g., 'STUDENT', 'TEACHER', 'SUPER_ADMIN'

    let notes = [];
    if (role === 'STUDENT') {
      // 1. Fetch student's personal notes
      const personalNotes = await prisma.note.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
      });

      // 2. Fetch student's enrolled courses shared notes
      const studentProfile = await prisma.student.findUnique({
        where: { userId },
      });

      let sharedNotes = [];
      if (studentProfile && studentProfile.classId) {
        sharedNotes = await prisma.note.findMany({
          where: {
            isShared: true,
            course: {
              courseClasses: {
                some: {
                  classId: studentProfile.classId
                }
              }
            }
          },
          include: {
            course: { select: { id: true, title: true } },
            user: { select: { name: true } } // Show teacher's name
          },
          orderBy: { updatedAt: 'desc' },
        });
      }

      notes = [
        ...personalNotes.map(n => ({ ...n, isPersonal: true })),
        ...sharedNotes.map(n => ({ ...n, isPersonal: false, teacherName: n.user?.name }))
      ];
    } else if (role === 'TEACHER') {
      // Fetch all notes created by this teacher
      const teacherNotes = await prisma.note.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      notes = teacherNotes.map(n => ({ ...n, isPersonal: n.courseId === null }));
    } else {
      // Admins etc.
      const allNotes = await prisma.note.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      notes = allNotes.map(n => ({ ...n, isPersonal: true }));
    }

    res.json(notes);
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, category, notebook, style, color, isShared, courseId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const note = await prisma.note.create({
      data: {
        userId,
        title,
        content,
        category: category || 'General',
        notebook: notebook || 'My Notebook',
        style: style || 'ruled',
        color: color || '#fef08a',
        isShared: isShared === true || isShared === 'true',
        courseId: courseId ? parseInt(courseId) : null,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    res.status(201).json(note);
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, content, category, notebook, style, color, isShared, courseId } = req.body;

    const note = await prisma.note.findUnique({
      where: { id: parseInt(id) },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    if (note.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this note.' });
    }

    const updatedNote = await prisma.note.update({
      where: { id: parseInt(id) },
      data: {
        title: title || note.title,
        content: content || note.content,
        category: category || note.category,
        notebook: notebook || note.notebook,
        style: style || note.style,
        color: color || note.color,
        isShared: isShared !== undefined ? (isShared === true || isShared === 'true') : note.isShared,
        courseId: courseId !== undefined ? (courseId ? parseInt(courseId) : null) : note.courseId,
      },
      include: { course: { select: { id: true, title: true } } },
    });

    res.json(updatedNote);
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const note = await prisma.note.findUnique({
      where: { id: parseInt(id) },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    if (note.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this note.' });
    }

    await prisma.note.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: 'Note deleted successfully.' });
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
};
