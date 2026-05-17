const prisma = require('../config/prisma');

// ─── SEND MESSAGE ───────────────────────────────────────
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, type } = req.body;
    if (!receiverId || !message) {
      return res.status(400).json({ error: 'Receiver and message are required.' });
    }

    const msg = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: parseInt(receiverId),
        message,
        type: type || 'TEXT',
      },
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: parseInt(receiverId),
        type: 'MESSAGE',
        title: 'New Message',
        message: `${req.user.fullName || req.user.name} sent you a message`,
      },
    });

    // Broadcast via WebSockets if receiver is online
    const wss = req.app.get('wss');
    const wsClients = req.app.get('wsClients');
    if (wsClients) {
      const receiverWs = wsClients.get(parseInt(receiverId));
      if (receiverWs && receiverWs.readyState === 1) { // 1 = OPEN
        receiverWs.send(JSON.stringify({
          type: 'NEW_MESSAGE',
          payload: msg
        }));
      }
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET CONVERSATIONS ──────────────────────────────────
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get unique conversation partners
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatar: true, role: true } },
        receiver: { select: { id: true, name: true, avatar: true, role: true } },
      },
    });

    // Group by conversation partner
    const conversationMap = new Map();
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(partnerId)) {
        const partner = msg.senderId === userId ? msg.receiver : msg.sender;
        conversationMap.set(partnerId, {
          partner,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      if (msg.receiverId === userId && !msg.isRead) {
        const entry = conversationMap.get(partnerId);
        if (entry) entry.unreadCount++;
      }
    }

    res.json(Array.from(conversationMap.values()));
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── GET MESSAGES WITH USER ─────────────────────────────
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = parseInt(req.params.partnerId);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark as read
    await prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── NOTIFICATIONS ──────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const role = req.user.role.toLowerCase();
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          { isGlobal: true, targetRole: 'all' },
          { isGlobal: true, targetRole: role === 'student' ? 'students' : role === 'teacher' ? 'teachers' : undefined }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(notifications);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.update({
        where: { id: parseInt(id) },
        data: { isRead: true },
      });
    }
    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await prisma.notification.deleteMany({
        where: { userId: req.user.id }
      });
    } else {
      const notificationId = parseInt(id);
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
      });

      if (!notification) return res.status(404).json({ error: 'Notification not found' });
      if (notification.userId !== req.user.id && !notification.isGlobal) {
        return res.status(403).json({ error: 'Unauthorized to delete this notification' });
      }

      await prisma.notification.delete({
        where: { id: notificationId }
      });
    }
    res.json({ message: 'Notification(s) deleted successfully.' });
  } catch (err) {
    console.error('deleteNotification error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

// ─── SEND ANNOUNCEMENT ──────────────────────────────────
const sendAnnouncement = async (req, res) => {
  try {
    const { title, message, classId } = req.body;
    let recipients = [];

    if (classId) {
      const students = await prisma.student.findMany({
        where: { classId: parseInt(classId) },
        include: { user: { select: { id: true } } },
      });
      recipients = students.map(s => s.user.id);
      
      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map(userId => ({
            userId,
            type: 'ANNOUNCEMENT',
            title: title || 'Class Announcement',
            message,
          })),
        });
      }
    } else {
      // Global announcement from teacher (to all their students?)
      // For simplicity, let's make it a global notification with targetRole: students
      await prisma.notification.create({
        data: {
          userId: req.user.id,
          type: 'ANNOUNCEMENT',
          title: title || 'General Announcement',
          message,
          isGlobal: true,
          targetRole: 'students',
        }
      });
    }

    res.json({ message: 'Announcement sent.', recipientCount: recipients.length });
  } catch (err) {
    console.error('Send announcement error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    const whereClause = {
      NOT: { id: req.user.id },
      isActive: true,
    };

    if (query && query.length >= 1) {
      whereClause.OR = [
        { name: { contains: query } },
        { email: { contains: query } },
        { student: { class: { name: { contains: query } } } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        student: { select: { class: { select: { name: true } } } },
      },
      take: 50,
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

const deleteAllMessages = async (req, res) => {
  try {
    await prisma.message.deleteMany({});
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'Delete All Messages',
        details: 'Admin deleted all messages in the platform'
      }
    });
    res.json({ message: 'All messages deleted successfully.' });
  } catch (err) {
    console.error('Delete all messages error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = {
  sendMessage, getConversations, getMessages,
  getNotifications, markNotificationRead, deleteNotification, sendAnnouncement,
  searchUsers, deleteAllMessages
};
