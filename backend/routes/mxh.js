const express = require('express');
const router = express.Router();
const mxhController = require('../controllers/mxhController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// Public routes
router.get('/categories', mxhController.getCategories);
router.get('/accounts', mxhController.getAccounts);
router.get('/accounts/:id', optionalAuth, mxhController.getAccountDetail);

// Protected routes (Admin & Seller)
router.post('/accounts', authenticate, authorize('admin', 'seller'), mxhController.createAccount);

// Protected routes (Any logged in user)
router.post('/accounts/:id/purchase', authenticate, mxhController.purchaseAccount);

// Admin only routes
router.post('/categories', authenticate, authorize('admin'), mxhController.adminCreateCategory);
router.put('/categories/:id', authenticate, authorize('admin'), mxhController.adminUpdateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), mxhController.adminDeleteCategory);

module.exports = router;
