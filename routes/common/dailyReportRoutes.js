const express = require('express');
const router = express.Router();
const dailyReportController = require('../../controllers/common/dailyReportController');
const { authenticate } = require('../../middleware/auth');

// All routes are protected
router.use(authenticate);

// Submit daily reports
router.post('/', dailyReportController.submitDailyReports);

// Get daily reports
router.get('/', dailyReportController.getDailyReports);

module.exports = router; 