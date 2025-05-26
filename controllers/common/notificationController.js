const Notification = require('../../models/Notification');
const NotificationPreference = require('../../models/NotificationPreference');
const logger = require('../../utils/logger');

const notificationController = {
    // Get user's notifications
    getMyNotifications: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                type,
                read,
                sortBy = 'createdAt',
                order = 'desc'
            } = req.query;

            const query = { user: req.user._id };

            if (type) query.type = type;
            if (read !== undefined) query.read = read === 'true';

            const sortOption = {};
            sortOption[sortBy] = order === 'desc' ? -1 : 1;

            const notifications = await Notification.find(query)
                .sort(sortOption)
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .populate('user', 'name photo');

            const total = await Notification.countDocuments(query);
            const unreadCount = await Notification.countDocuments({
                user: req.user._id,
                read: false
            });

            res.json({
                notifications,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
                unreadCount
            });
        } catch (error) {
            logger.error('Get notifications error:', error);
            res.status(500).json({ message: 'Failed to fetch notifications' });
        }
    },

    // Mark notification as read
    markAsRead: async (req, res) => {
        try {
            const notification = await Notification.findOne({
                _id: req.params.id,
                user: req.user._id
            });

            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            notification.read = true;
            await notification.save();

            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            logger.error('Mark notification as read error:', error);
            res.status(500).json({ message: 'Failed to mark notification as read' });
        }
    },

    // Mark all notifications as read
    markAllAsRead: async (req, res) => {
        try {
            await Notification.updateMany(
                { user: req.user._id, read: false },
                { $set: { read: true } }
            );

            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            logger.error('Mark all notifications as read error:', error);
            res.status(500).json({ message: 'Failed to mark notifications as read' });
        }
    },

    // Delete notification
    deleteNotification: async (req, res) => {
        try {
            const notification = await Notification.findOne({
                _id: req.params.id,
                user: req.user._id
            });

            if (!notification) {
                return res.status(404).json({ message: 'Notification not found' });
            }

            await notification.deleteOne();
            res.json({ message: 'Notification deleted successfully' });
        } catch (error) {
            logger.error('Delete notification error:', error);
            res.status(500).json({ message: 'Failed to delete notification' });
        }
    },

    // Get notification preferences
    getPreferences: async (req, res) => {
        try {
            let preferences = await NotificationPreference.findOne({
                user: req.user._id
            });

            if (!preferences) {
                // Create default preferences if none exist
                preferences = new NotificationPreference({
                    user: req.user._id,
                    emailNotifications: true,
                    pushNotifications: true,
                    taskUpdates: true,
                    projectUpdates: true,
                    teamUpdates: true,
                    systemUpdates: true
                });
                await preferences.save();
            }

            res.json(preferences);
        } catch (error) {
            logger.error('Get notification preferences error:', error);
            res.status(500).json({ message: 'Failed to fetch notification preferences' });
        }
    },

    // Update notification preferences
    updatePreferences: async (req, res) => {
        try {
            const allowedUpdates = [
                'emailNotifications',
                'pushNotifications',
                'taskUpdates',
                'projectUpdates',
                'teamUpdates',
                'systemUpdates'
            ];

            let preferences = await NotificationPreference.findOne({
                user: req.user._id
            });

            if (!preferences) {
                preferences = new NotificationPreference({
                    user: req.user._id
                });
            }

            allowedUpdates.forEach(update => {
                if (req.body[update] !== undefined) {
                    preferences[update] = req.body[update];
                }
            });

            await preferences.save();
            res.json(preferences);
        } catch (error) {
            logger.error('Update notification preferences error:', error);
            res.status(500).json({ message: 'Failed to update notification preferences' });
        }
    }
};

module.exports = notificationController; 