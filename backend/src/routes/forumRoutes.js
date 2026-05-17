const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Forum Topics/Categories (Subjects)
router.get('/categories', forumController.getCategories);

// Threads
router.get('/categories/:categoryId/threads', forumController.getThreads);
router.post('/categories/:categoryId/threads', forumController.createThread);
router.get('/threads/:threadId', forumController.getThreadDetails);
router.put('/threads/:threadId', forumController.updateThread); // Pin/Lock/Delete (delete usually DELETE, but can handle here)
router.delete('/threads/:threadId', forumController.deleteThread);

// Posts
router.post('/threads/:threadId/posts', forumController.createPost);
router.delete('/posts/:postId', forumController.deletePost);

module.exports = router;
