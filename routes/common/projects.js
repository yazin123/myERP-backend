const express = require('express');
const router = express.Router();
const { auth, requireRoles } = require('../../middleware/auth');
const projectController = require('../../controllers/common/projectController');

// Get all projects (with filters)
router.get('/', auth, projectController.getProjects);

// Get project by ID
router.get('/:projectId', auth, projectController.getProjectById);

// Create new project
router.post('/', auth, requireRoles('admin', 'manager'), projectController.createProject);

// Update project
router.put('/:projectId', auth, projectController.updateProject);

// Delete project
router.delete('/:projectId', auth, requireRoles('admin'), projectController.deleteProject);

// Project team management
router.post('/:projectId/team', auth, requireRoles('admin', 'manager'), projectController.addTeamMember);
router.delete('/:projectId/team/:userId', auth, requireRoles('admin', 'manager'), projectController.removeTeamMember);

// Project milestones
router.post('/:projectId/milestones', auth, projectController.addMilestone);
router.put('/:projectId/milestones/:milestoneId', auth, projectController.updateMilestone);
router.delete('/:projectId/milestones/:milestoneId', auth, projectController.deleteMilestone);

// Project documents
router.post('/:projectId/documents', auth, projectController.uploadDocument);
router.delete('/:projectId/documents/:documentId', auth, projectController.deleteDocument);

// Project risks
router.post('/:projectId/risks', auth, projectController.addRisk);
router.put('/:projectId/risks/:riskId', auth, projectController.updateRisk);
router.delete('/:projectId/risks/:riskId', auth, projectController.deleteRisk);

// Project statistics
router.get('/:projectId/statistics', auth, projectController.getProjectStatistics);

// Project tasks
router.get('/:projectId/tasks', auth, projectController.getProjectTasks);

module.exports = router; 