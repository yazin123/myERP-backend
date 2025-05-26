const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const projectController = require('../../controllers/common/projectController');

// Get user's projects with filters and pagination
router.get('/my-projects', authenticate, projectController.getMyProjects);

// Get single project details (if user has access)
router.get('/:id', authenticate, projectController.getProjectById);

// Project updates and notifications
router.post('/:id/updates', authenticate, projectController.addProjectUpdate);
router.get('/:id/updates', authenticate, projectController.getProjectUpdates);
router.post('/:id/subscribe', authenticate, projectController.subscribeToProject);
router.delete('/:id/subscribe', authenticate, projectController.unsubscribeFromProject);

module.exports = router; 