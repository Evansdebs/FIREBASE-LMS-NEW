const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// ─── PUBLIC (any authenticated user) ───────────────────
router.get('/', shopController.getShopItems);
router.post('/:id/interest', shopController.toggleInterest);

// ─── TEACHER & ADMIN: Create/manage own items ──────────
router.post('/', shopController.createShopItem);
router.put('/:id', shopController.updateShopItem);
router.delete('/:id', shopController.deleteShopItem);
router.get('/my-items', shopController.getMyShopItems);

// ─── ADMIN ONLY ────────────────────────────────────────
router.get('/pending', admin, shopController.getPendingItems);
router.get('/all', admin, shopController.getAllShopItems);
router.put('/:id/approve', admin, shopController.approveShopItem);
router.put('/:id/reject', admin, shopController.rejectShopItem);
router.get('/:id/interests', admin, shopController.getItemInterests);

module.exports = router;
