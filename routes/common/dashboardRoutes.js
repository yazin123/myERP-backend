const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const dashboardController = require('../../controllers/common/dashboardController');

// Dashboard routes for regular users
router.get('/', authenticate, dashboardController.getMyDashboardStats);

module.exports = router; 