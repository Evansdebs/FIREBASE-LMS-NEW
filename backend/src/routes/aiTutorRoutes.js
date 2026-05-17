const express = require('express');
const router = express.Router();
const { teachMe, saveAINotes } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

// AI Tutor routes require authentication
router.use(protect);

router.post('/teach', teachMe);
router.post('/save', saveAINotes);

module.exports = router;
