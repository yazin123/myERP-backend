const express = require('express');
const router = express.Router();

// Import all route modules
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const taskRoutes = require('./taskRoutes');
const departmentRoutes = require('./departmentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const timelineEventRoutes = require('./timelineEventRoutes');
const calendarRoutes = require('./calendarRoutes');
const dailyReportRoutes = require('./dailyReportRoutes');
const notificationRoutes = require('./notificationRoutes');
const systemRoutes = require('./systemRoutes');

// Mount routes
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/departments', departmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/timeline', timelineEventRoutes);
router.use('/calendar', calendarRoutes);
router.use('/daily-reports', dailyReportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/system', systemRoutes);

module.exports = router; 