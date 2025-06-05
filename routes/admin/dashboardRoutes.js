const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../../middleware/auth');
const dashboardController = require('../../controllers/common/dashboardController');

// Admin dashboard routes
router.get('/stats', [auth, isAdmin], dashboardController.getAdminDashboardStats);

module.exports = router; 