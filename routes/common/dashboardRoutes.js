const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const dashboardController = require('../../controllers/common/dashboardController');

// User dashboard routes
router.get('/stats', auth, dashboardController.getUserDashboardStats);

module.exports = router; 