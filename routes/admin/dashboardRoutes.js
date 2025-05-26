const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../middleware/auth');
const dashboardController = require('../../controllers/admin/dashboardController');

// Dashboard routes
router.get('/', adminAuth, dashboardController.getDashboardStats);
router.get('/stats', adminAuth, dashboardController.getDashboardStats); // Keep for backward compatibility

module.exports = router; 