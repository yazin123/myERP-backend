const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const notificationController = require('../../controllers/common/notificationController');

// Get user's notifications with pagination
router.get('/', authenticate, notificationController.getMyNotifications);

// Mark notifications as read
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', authenticate, notificationController.deleteNotification);

// Notification preferences
router.get('/preferences', authenticate, notificationController.getPreferences);
router.put('/preferences', authenticate, notificationController.updatePreferences);

module.exports = router; 