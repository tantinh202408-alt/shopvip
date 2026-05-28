const express = require('express');
const router = express.Router();
const mxhController = require('../controllers/mxhController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { featureGuard } = require('../middleware/featureGuard');

// Public routes
router.get('/stats', mxhController.getStats);
router.get('/categories', optionalAuth, featureGuard('mxh', { allowAdminBypass: true }), mxhController.getCategories);
router.get('/accounts', optionalAuth, featureGuard('mxh', { allowAdminBypass: true }), mxhController.getAccounts);
router.get('/accounts/:id', optionalAuth, featureGuard('mxh', { allowAdminBypass: true }), mxhController.getAccountDetail);

// Protected routes (Admin & Seller)
router.post('/accounts', authenticate, featureGuard('mxh', { allowAdminBypass: true }), authorize('admin', 'seller'), mxhController.createAccount);

// Protected routes (Any logged in user)
router.post('/accounts/:id/purchase', authenticate, featureGuard('mxh', { allowAdminBypass: true }), mxhController.purchaseAccount);

// Admin only routes
router.post('/categories', authenticate, authorize('admin'), mxhController.adminCreateCategory);
router.put('/categories/:id', authenticate, authorize('admin'), mxhController.adminUpdateCategory);
router.delete('/categories/:id', authenticate, authorize('admin'), mxhController.adminDeleteCategory);

module.exports = router;
