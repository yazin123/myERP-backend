const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const taskController = require('../../controllers/common/taskController');

// Get all tasks with filtering
router.get('/', authenticate, taskController.getTasks);

// Get tasks board data (Kanban view)
router.get('/board', authenticate, taskController.getTasksBoard);

// Get user's tasks
router.get('/my-tasks', authenticate, taskController.getMyTasks);

// Create new task
router.post('/', authenticate, taskController.createTask);

// Get single task details
router.get('/:id', authenticate, taskController.getTaskById);

// Update task
router.put('/:id', authenticate, taskController.updateTask);

// Delete task
router.delete('/:id', authenticate, taskController.deleteTask);

// Update task status
router.patch('/:id/status', authenticate, taskController.updateTaskStatus);

// Task comments
router.post('/:id/comments', authenticate, taskController.addTaskComment);
router.get('/:id/comments', authenticate, taskController.getTaskComments);
router.put('/:id/comments/:commentId', authenticate, taskController.updateTaskComment);
router.delete('/:id/comments/:commentId', authenticate, taskController.deleteTaskComment);

module.exports = router;