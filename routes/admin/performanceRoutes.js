// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/auth');
const performanceController = require('../../controllers/admin/performanceController');

// Get all performance records
router.get('/', 
  authenticate, 
  authorize(['admin', 'teamlead', 'manager']), 
  performanceController.getAllPerformance
);

// Get performance by ID
router.get('/id/:id', 
  authenticate, 
  performanceController.getPerformanceById
);

// Create new performance record
router.post('/',
  authenticate,
  authorize(['admin', 'teamlead', 'manager']),
  performanceController.createPerformance
);

// Get user performance summary
router.get('/summary/:userId',
  authenticate,
  authorize(['admin', 'teamlead', 'manager']),
  performanceController.getUserPerformanceSummary
);

// Get own performance summary
router.get('/summary',
  authenticate,
  performanceController.getOwnPerformanceSummary
);

module.exports = router;

