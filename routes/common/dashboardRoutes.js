const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const dashboardController = require('../../controllers/common/dashboardController');

// User dashboard routes
router.get('/stats', authenticate, dashboardController.getUserDashboardStats);

module.exports = router; 