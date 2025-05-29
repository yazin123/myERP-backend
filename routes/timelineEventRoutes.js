const express = require('express');
const router = express.Router();
const timelineEventController = require('../controllers/admin/timelineEventController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Routes for project-specific events
router.route('/projects/:id/timeline')
    .get(timelineEventController.getProjectEvents)
    .post(authorize('admin', 'manager', 'project_head'), timelineEventController.addTimelineEvent);

router.route('/projects/:id/timeline/:eventId')
    .put(authorize('admin', 'manager', 'project_head'), timelineEventController.updateTimelineEvent)
    .delete(authorize('admin', 'manager', 'project_head'), timelineEventController.deleteTimelineEvent);

// Route for all events (across all projects)
router.get('/events', timelineEventController.getAllEvents);

module.exports = router; 