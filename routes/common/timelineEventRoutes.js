const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../../middleware/auth');
const timelineEventController = require('../../controllers/common/timelineEventController');

// Get all timeline events
router.get('/', authenticate, timelineEventController.getTimelineEvents);

// Get project timeline events (must come before /:eventId)
router.get('/project/:projectId', authenticate, timelineEventController.getProjectTimelineEvents);

// Get timeline event by ID
router.get('/:eventId', authenticate, timelineEventController.getTimelineEventById);

// Create timeline event
router.post('/', authenticate, timelineEventController.createTimelineEvent);

// Update timeline event
router.put('/:eventId', authenticate, timelineEventController.updateTimelineEvent);

// Delete timeline event
router.delete('/:eventId', authenticate, timelineEventController.deleteTimelineEvent);

module.exports = router; 