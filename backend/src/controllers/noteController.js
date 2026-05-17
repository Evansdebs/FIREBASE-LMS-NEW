const prisma = require('../config/prisma');

const getNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const notes = await prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const createNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, category } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const note = await prisma.note.create({
      data: {
        userId,
        title,
        content,
        category: category || 'General',
      },
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
    const { title, content, category } = req.body;

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
      },
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
