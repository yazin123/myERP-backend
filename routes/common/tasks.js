const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const taskController = require('../../controllers/common/taskController');

// Get all tasks (with filters)
router.get('/', auth, taskController.getTasks);

// Get task by ID
router.get('/:taskId', auth, taskController.getTaskById);

// Create new task
router.post('/', auth, taskController.createTask);

// Update task
router.put('/:taskId', auth, taskController.updateTask);

// Delete task
router.delete('/:taskId', auth, taskController.deleteTask);

// Get tasks for current user
router.get('/my-tasks', auth, taskController.getMyTasks);

// Get tasks board data (for Kanban view)
router.get('/board', auth, taskController.getTasksBoard);

module.exports = router; 