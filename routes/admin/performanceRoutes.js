// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const { loginAuth, teamLeadAuth, adminAuth } = require('../../middleware/auth');
const performance = require('../../controllers/admin/performanceController');

router.get('/', loginAuth, performance.getAllPerformance);
router.get('/id/:id', loginAuth, performance.getPerformanceById);
router.get('/performance-summary', loginAuth, performance.getUserPerformanceSummary);

module.exports = router;

