const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const dashboardController = require('../controllers/common/dashboardController');

// Dashboard routes
router.get('/dashboard/stats', auth, dashboardController.getDashboardStats);

module.exports = router; 