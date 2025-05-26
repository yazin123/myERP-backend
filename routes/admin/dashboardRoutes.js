const express = require('express');
const router = express.Router();
const { loginAuth } = require('../../middleware/auth');
const dashboardController = require('../../controllers/admin/dashboardController');

// Dashboard routes
router.get('/stats', loginAuth, dashboardController.getDashboardStats);

module.exports = router; 