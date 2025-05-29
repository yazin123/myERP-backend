const express = require('express');
const router = express.Router();
const taskController = require('../controllers/admin/taskController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Get user's tasks
router.get('/my-tasks', taskController.getMyTasks);

// Get specific task
router.get('/:taskId', taskController.getTaskById);

// Update task status
router.put('/:taskId/status', taskController.updateTaskStatus);

module.exports = router; 