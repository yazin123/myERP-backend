const CalendarEvent = require('../../models/CalendarEvent');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const logger = require('../../utils/logger');

const calendarController = {
    // Get all calendar events
    getEvents: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const userId = req.user._id;

            // Build query
            const query = {
                $or: [
                    { createdBy: userId },
                    { participants: userId }
                ]
            };

            // Add date range filter if provided
            if (startDate || endDate) {
                query.start = {};
                if (startDate) query.start.$gte = new Date(startDate);
                if (endDate) query.start.$lte = new Date(endDate);
            }

            // Get calendar events
            const events = await CalendarEvent.find(query)
                .populate('createdBy', 'name photo')
                .populate('participants', 'name photo')
                .populate('relatedProject', 'name')
                .populate('relatedTask', 'title')
                .sort({ start: 1 });

            // Get project events
            const projects = await Project.find({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ],
                startDate: query.start
            }).select('name startDate endDate');

            // Get task deadlines
            const tasks = await Task.find({
                $or: [
                    { assignedTo: userId },
                    { createdBy: userId }
                ],
                dueDate: query.start
            }).select('title dueDate priority status');

            // Combine all events
            const allEvents = [
                ...events.map(event => ({
                    ...event.toObject(),
                    eventType: 'calendar'
                })),
                ...projects.map(project => ({
                    _id: project._id,
                    title: `Project Start: ${project.name}`,
                    start: project.startDate,
                    end: project.startDate,
                    type: 'project',
                    color: '#2196F3',
                    eventType: 'project'
                })),
                ...projects.map(project => ({
                    _id: project._id,
                    title: `Project Due: ${project.name}`,
                    start: project.endDate,
                    end: project.endDate,
                    type: 'project',
                    color: '#F44336',
                    eventType: 'project'
                })),
                ...tasks.map(task => ({
                    _id: task._id,
                    title: task.title,
                    start: task.dueDate,
                    end: task.dueDate,
                    type: 'task',
                    color: task.priority === 'high' ? '#F44336' : 
                           task.priority === 'medium' ? '#FF9800' : '#4CAF50',
                    status: task.status,
                    eventType: 'task'
                }))
            ];

            res.json({
                success: true,
                data: allEvents
            });
        } catch (error) {
            logger.error('Error getting calendar events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch calendar events'
            });
        }
    },

    // Create new calendar event
    createEvent: async (req, res) => {
        try {
            const eventData = {
                ...req.body,
                createdBy: req.user._id
            };

            const event = new CalendarEvent(eventData);
            await event.save();

            await event.populate([
                { path: 'createdBy', select: 'name photo' },
                { path: 'participants', select: 'name photo' },
                { path: 'relatedProject', select: 'name' },
                { path: 'relatedTask', select: 'title' }
            ]);

            res.status(201).json({
                success: true,
                data: event
            });
        } catch (error) {
            logger.error('Error creating calendar event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create calendar event'
            });
        }
    },

    // Update calendar event
    updateEvent: async (req, res) => {
        try {
            const event = await CalendarEvent.findOneAndUpdate(
                {
                    _id: req.params.id,
                    $or: [
                        { createdBy: req.user._id },
                        { participants: req.user._id }
                    ]
                },
                req.body,
                { new: true }
            ).populate([
                { path: 'createdBy', select: 'name photo' },
                { path: 'participants', select: 'name photo' },
                { path: 'relatedProject', select: 'name' },
                { path: 'relatedTask', select: 'title' }
            ]);

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Calendar event not found or access denied'
                });
            }

            res.json({
                success: true,
                data: event
            });
        } catch (error) {
            logger.error('Error updating calendar event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update calendar event'
            });
        }
    },

    // Delete calendar event
    deleteEvent: async (req, res) => {
        try {
            const event = await CalendarEvent.findOneAndDelete({
                _id: req.params.id,
                createdBy: req.user._id
            });

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Calendar event not found or access denied'
                });
            }

            res.json({
                success: true,
                message: 'Calendar event deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting calendar event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete calendar event'
            });
        }
    }
};

module.exports = calendarController; 