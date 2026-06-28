const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect, admin, teacher } = require('../middleware/authMiddleware');

router.use(protect);

// Personal Messages
router.get('/conversations', messageController.getConversations);
router.get('/search', messageController.searchUsers);
router.post('/send', messageController.sendMessage);

// Notifications
router.get('/notifications', messageController.getNotifications);
router.put('/notifications/:id/read', messageController.markNotificationRead);
router.delete('/notifications/:id', messageController.deleteNotification);

// Personal Messages (Parametric route at the bottom)
router.get('/:partnerId', messageController.getMessages);

// Announcements (Admin and Teachers only)
router.post('/announcements', messageController.sendAnnouncement);

// Administrative (Delete all messages)
router.delete('/delete-all', admin, messageController.deleteAllMessages);

// Personal Messages Deletion
router.delete('/:id', messageController.deleteMessage);

module.exports = router;
