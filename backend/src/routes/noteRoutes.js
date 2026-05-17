const express = require('express');
const router = express.Router();
const { 
  getNotes, 
  createNote, 
  updateNote, 
  deleteNote 
} = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

// All notes routes require authentication
router.use(protect);

router.get('/', getNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
