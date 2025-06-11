const express = require('express');
const router = express.Router();
const { authenticate, isAdmin } = require('../../middleware/auth');
const dashboardController = require('../../controllers/admin/dashboardController');

// Get dashboard overview
router.get('/overview', authenticate, isAdmin, dashboardController.getOverview);

// Get user metrics
router.get('/users', authenticate, isAdmin, dashboardController.getUserMetrics);

// Get project metrics
router.get('/projects', authenticate, isAdmin, dashboardController.getProjectMetrics);

// Get department metrics
router.get('/departments', authenticate, isAdmin, dashboardController.getDepartmentMetrics);

// Get financial metrics
router.get('/financials', authenticate, isAdmin, dashboardController.getFinancialMetrics);

// Get performance metrics
router.get('/performance', authenticate, isAdmin, dashboardController.getPerformanceMetrics);

module.exports = router; 