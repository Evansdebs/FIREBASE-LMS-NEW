const prisma = require('../config/prisma');

// ─── GET APPROVED SHOP ITEMS (all users) ───────────────
const getShopItems = async (req, res) => {
  try {
    const { category } = req.query;
    const where = { status: 'APPROVED' };
    if (category && category !== 'ALL') where.category = category;

    const items = await prisma.shopItem.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, role: true } },
        _count: { select: { interests: true } },
        interests: { where: { userId: req.user.id }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items.map(item => ({
      ...item,
      interestCount: item._count.interests,
      hasInterest: item.interests.length > 0,
    })));
  } catch (err) {
    console.error('Get shop items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET PENDING ITEMS (admin only) ───────────────────
const getPendingItems = async (req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      where: { status: 'PENDING' },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        _count: { select: { interests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('Get pending items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET ALL ITEMS (admin only) ───────────────────────
const getAllShopItems = async (req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      include: {
        creator: { select: { id: true, name: true, role: true } },
        _count: { select: { interests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('Get all shop items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET MY ITEMS (teacher) ───────────────────────────
const getMyShopItems = async (req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      where: { createdBy: req.user.id },
      include: { _count: { select: { interests: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('Get my shop items error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── CREATE SHOP ITEM ─────────────────────────────────
const createShopItem = async (req, res) => {
  try {
    const { title, description, price, category, imageUrl, contactPhone } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required.' });
    if (!contactPhone) return res.status(400).json({ error: 'Contact phone number is required.' });

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'SUPER_ADMIN';
    const status = isAdmin ? 'APPROVED' : 'PENDING';

    const item = await prisma.shopItem.create({
      data: {
        title,
        description,
        price: parseFloat(price) || 0,
        category: category || 'GENERAL',
        imageUrl: imageUrl || null,
        contactPhone,
        status,
        createdBy: req.user.id,
      },
      include: {
        creator: { select: { id: true, name: true, role: true } },
        _count: { select: { interests: true } },
      },
    });
    res.status(201).json(item);
  } catch (err) {
    console.error('Create shop item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── UPDATE SHOP ITEM ─────────────────────────────────
const updateShopItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category, imageUrl, contactPhone } = req.body;
    const item = await prisma.shopItem.findUnique({ where: { id: parseInt(id) } });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'SUPER_ADMIN';
    if (!isAdmin && item.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const updated = await prisma.shopItem.update({
      where: { id: parseInt(id) },
      data: { title, description, price: parseFloat(price) || 0, category, imageUrl, contactPhone },
      include: { creator: { select: { id: true, name: true } }, _count: { select: { interests: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error('Update shop item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── DELETE SHOP ITEM ─────────────────────────────────
const deleteShopItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.shopItem.findUnique({ where: { id: parseInt(id) } });
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'SUPER_ADMIN';
    if (!isAdmin && item.createdBy !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    await prisma.shopItem.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Item deleted.' });
  } catch (err) {
    console.error('Delete shop item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── APPROVE / REJECT (admin only) ────────────────────
const approveShopItem = async (req, res) => {
  try {
    const item = await prisma.shopItem.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'APPROVED' },
      include: { creator: { select: { name: true } } },
    });
    res.json(item);
  } catch (err) {
    console.error('Approve item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const rejectShopItem = async (req, res) => {
  try {
    const item = await prisma.shopItem.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'REJECTED' },
      include: { creator: { select: { name: true } } },
    });
    res.json(item);
  } catch (err) {
    console.error('Reject item error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── TOGGLE INTEREST ──────────────────────────────────
const toggleInterest = async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await prisma.shopInterest.findUnique({
      where: { itemId_userId: { itemId, userId } },
    });

    if (existing) {
      await prisma.shopInterest.delete({ where: { id: existing.id } });
      res.json({ hasInterest: false, message: 'Interest removed.' });
    } else {
      await prisma.shopInterest.create({ data: { itemId, userId } });
      res.json({ hasInterest: true, message: 'Interest noted!' });
    }
  } catch (err) {
    console.error('Toggle interest error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET INTERESTED USERS FOR AN ITEM (admin/owner) ───
const getItemInterests = async (req, res) => {
  try {
    const interests = await prisma.shopInterest.findMany({
      where: { itemId: parseInt(req.params.id) },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(interests);
  } catch (err) {
    console.error('Get item interests error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  getShopItems,
  getPendingItems,
  getAllShopItems,
  getMyShopItems,
  createShopItem,
  updateShopItem,
  deleteShopItem,
  approveShopItem,
  rejectShopItem,
  toggleInterest,
  getItemInterests,
};
