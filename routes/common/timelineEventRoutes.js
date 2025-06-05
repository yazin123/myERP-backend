const express = require('express');
const router = express.Router();
const { auth, requireRoles } = require('../../middleware/auth');
const timelineEventController = require('../../controllers/common/timelineEventController');

// Get all timeline events
router.get('/', auth, timelineEventController.getTimelineEvents);

// Get project timeline events (must come before /:eventId)
router.get('/project/:projectId', auth, timelineEventController.getProjectTimelineEvents);

// Get timeline event by ID
router.get('/:eventId', auth, timelineEventController.getTimelineEventById);

// Create timeline event
router.post('/', auth, timelineEventController.createTimelineEvent);

// Update timeline event
router.put('/:eventId', auth, timelineEventController.updateTimelineEvent);

// Delete timeline event
router.delete('/:eventId', auth, timelineEventController.deleteTimelineEvent);

module.exports = router; 