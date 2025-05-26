const User = require('../models/User');

// In-memory notification queue for processing
const notificationQueue = [];

// Function to create and send a notification
exports.createNotification = async ({ userId, type, message, reference }) => {
    try {
        const notification = {
            userId,
            type,
            message,
            reference,
            timestamp: new Date(),
            read: false
        };

        // Add to queue for processing
        notificationQueue.push(notification);

        // Process notification (in real implementation, this would be handled by a message queue)
        await processNotification(notification);

        return notification;
    } catch (error) {
        console.log('Error creating notification:', error);
        throw error;
    }
};

// Process notification based on type
const processNotification = async (notification) => {
    try {
        const user = await User.findById(notification.userId);
        if (!user) {
            console.log(`User not found for notification: ${notification.userId}`);
            return;
        }

        // Here you would implement different notification channels
        // For example: email, push notification, in-app notification, etc.
        
        switch (notification.type) {
            case 'project_assignment':
                await sendProjectAssignmentNotification(user, notification);
                break;
            case 'task_assignment':
                await sendTaskAssignmentNotification(user, notification);
                break;
            case 'project_update':
                await sendProjectUpdateNotification(user, notification);
                break;
            case 'deadline_reminder':
                await sendDeadlineReminderNotification(user, notification);
                break;
            default:
                await sendDefaultNotification(user, notification);
        }
    } catch (error) {
        console.log('Error processing notification:', error);
        throw error;
    }
};

// Notification type handlers
const sendProjectAssignmentNotification = async (user, notification) => {
    // TODO: Implement email notification
    console.log(`Project assignment notification for ${user.email}: ${notification.message}`);
    
    // TODO: Implement push notification
    console.log(`Push notification sent to ${user.email}`);
};

const sendTaskAssignmentNotification = async (user, notification) => {
    // TODO: Implement email notification
    console.log(`Task assignment notification for ${user.email}: ${notification.message}`);
    
    // TODO: Implement push notification
    console.log(`Push notification sent to ${user.email}`);
};

const sendProjectUpdateNotification = async (user, notification) => {
    // TODO: Implement email notification
    console.log(`Project update notification for ${user.email}: ${notification.message}`);
    
    // TODO: Implement push notification
    console.log(`Push notification sent to ${user.email}`);
};

const sendDeadlineReminderNotification = async (user, notification) => {
    // TODO: Implement email notification
    console.log(`Deadline reminder notification for ${user.email}: ${notification.message}`);
    
    // TODO: Implement push notification
    console.log(`Push notification sent to ${user.email}`);
};

const sendDefaultNotification = async (user, notification) => {
    // TODO: Implement email notification
    console.log(`Default notification for ${user.email}: ${notification.message}`);
    
    // TODO: Implement push notification
    console.log(`Push notification sent to ${user.email}`);
};

// Function to get unread notifications for a user
exports.getUnreadNotifications = async (userId) => {
    try {
        return notificationQueue.filter(n => 
            n.userId.toString() === userId.toString() && !n.read
        );
    } catch (error) {
        console.log('Error getting unread notifications:', error);
        throw error;
    }
};

// Function to mark notification as read
exports.markNotificationAsRead = async (notificationId, userId) => {
    try {
        const notification = notificationQueue.find(n => 
            n.userId.toString() === userId.toString() && 
            n._id.toString() === notificationId.toString()
        );

        if (notification) {
            notification.read = true;
            return true;
        }
        return false;
    } catch (error) {
        console.log('Error marking notification as read:', error);
        throw error;
    }
};

// Function to clear old notifications (older than 30 days)
exports.clearOldNotifications = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldNotifications = notificationQueue.filter(n => 
        n.timestamp < thirtyDaysAgo
    );

    oldNotifications.forEach(n => {
        const index = notificationQueue.indexOf(n);
        if (index > -1) {
            notificationQueue.splice(index, 1);
        }
    });
}; 