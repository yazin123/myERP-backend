const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const projectTaskController = require('../../controllers/projectTaskController');

// Project task routes (authenticated users)
router.get('/projects/:projectId/tasks', authenticate, projectTaskController.getProjectTasks);
router.post('/projects/:projectId/tasks', authenticate, projectTaskController.createProjectTask);
router.put('/projects/:projectId/tasks/:taskId', authenticate, projectTaskController.updateProjectTask);
router.delete('/projects/:projectId/tasks/:taskId', authenticate, projectTaskController.deleteProjectTask);
router.post('/projects/:projectId/assign-tasks', authenticate, projectTaskController.assignProjectTasks);

module.exports = router; 