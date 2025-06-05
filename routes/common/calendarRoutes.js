const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const calendarController = require('../../controllers/common/calendarController');

// Get all calendar events
router.get('/events', authenticate, calendarController.getEvents);

// Create new calendar event
router.post('/events', authenticate, calendarController.createEvent);

// Update calendar event
router.put('/events/:id', authenticate, calendarController.updateEvent);

// Delete calendar event
router.delete('/events/:id', authenticate, calendarController.deleteEvent);

module.exports = router; 