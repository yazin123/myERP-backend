const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const taskController = require('../../controllers/common/taskController');

// Get user's tasks with filters and pagination
router.get('/my-tasks', authenticate, taskController.getMyTasks);

// Get single task details (if user has access)
router.get('/:id', authenticate, taskController.getTaskById);

// Update task status
router.patch('/:id/status', authenticate, taskController.updateTaskStatus);

// Task comments
router.post('/:id/comments', authenticate, taskController.addTaskComment);
router.get('/:id/comments', authenticate, taskController.getTaskComments);
router.put('/:id/comments/:commentId', authenticate, taskController.updateTaskComment);
router.delete('/:id/comments/:commentId', authenticate, taskController.deleteTaskComment);

module.exports = router; 