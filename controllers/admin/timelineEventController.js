const Project = require('../../models/Project');
const { createNotification } = require('../../utils/notification');

const timelineEventController = {
    async addTimelineEvent(req, res) {
        try {
            const { id: projectId } = req.params;
            const { title, description, date, type } = req.body;

            // Validate required fields
            if (!title || !date || !type) {
                return res.status(400).json({
                    success: false,
                    message: 'Title, date, and type are required'
                });
            }

            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Create new timeline event
            const newEvent = {
                title,
                description,
                date: new Date(date),
                type,
                createdBy: req.user._id,
                createdAt: new Date()
            };

            // Add event to project timeline
            if (!project.timeline) {
                project.timeline = [];
            }
            project.timeline.push(newEvent);
            await project.save();

            // Send notification to project members
            try {
                const notificationPromises = [project.projectHead, ...project.members].map(userId =>
                    createNotification({
                        userId,
                        type: 'project_update',
                        message: `New ${type} added to project ${project.name}: ${title}`,
                        reference: {
                            type: 'Project',
                            id: project._id
                        }
                    })
                );
                await Promise.all(notificationPromises);
            } catch (notificationError) {
                console.error('Failed to send timeline event notifications:', notificationError);
            }

            res.status(201).json({
                success: true,
                data: newEvent
            });
        } catch (error) {
            console.error('Error in addTimelineEvent:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add timeline event',
                error: error.message
            });
        }
    },

    async updateTimelineEvent(req, res) {
        try {
            const { id: projectId, eventId } = req.params;
            const { title, description, date, type, status } = req.body;

            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const event = project.timeline.id(eventId);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Timeline event not found'
                });
            }

            // Update event fields
            if (title) event.title = title;
            if (description) event.description = description;
            if (date) event.date = new Date(date);
            if (type) event.type = type;
            if (status) event.status = status;

            await project.save();

            // Send notification about update
            try {
                await createNotification({
                    userId: project.projectHead,
                    type: 'project_update',
                    message: `Timeline event "${event.title}" has been updated`,
                    reference: {
                        type: 'Project',
                        id: project._id
                    }
                });
            } catch (notificationError) {
                console.error('Failed to send timeline update notification:', notificationError);
            }

            res.json({
                success: true,
                data: event
            });
        } catch (error) {
            console.error('Error in updateTimelineEvent:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update timeline event',
                error: error.message
            });
        }
    },

    async deleteTimelineEvent(req, res) {
        try {
            const { id: projectId, eventId } = req.params;

            const project = await Project.findById(projectId);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const event = project.timeline.id(eventId);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: 'Timeline event not found'
                });
            }

            event.remove();
            await project.save();

            res.json({
                success: true,
                message: 'Timeline event deleted successfully'
            });
        } catch (error) {
            console.error('Error in deleteTimelineEvent:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete timeline event',
                error: error.message
            });
        }
    },

    async getProjectEvents(req, res) {
        try {
            const { id: projectId } = req.params;
            const { startDate, endDate } = req.query;

            const project = await Project.findById(projectId)
                .populate('timeline.createdBy', 'name photo');

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            let events = project.timeline || [];

            // Filter by date range if provided
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                events = events.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= start && eventDate <= end;
                });
            }

            res.json({
                success: true,
                data: events
            });
        } catch (error) {
            console.error('Error in getProjectEvents:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project events',
                error: error.message
            });
        }
    },

    async getAllEvents(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const userId = req.user._id;

            // Find all projects where user is either project head or member
            const projects = await Project.find({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ]
            }).populate('timeline.createdBy', 'name photo');

            let allEvents = [];

            projects.forEach(project => {
                const projectEvents = (project.timeline || []).map(event => ({
                    ...event.toObject(),
                    projectId: project._id,
                    projectName: project.name
                }));
                allEvents = [...allEvents, ...projectEvents];
            });

            // Filter by date range if provided
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                allEvents = allEvents.filter(event => {
                    const eventDate = new Date(event.date);
                    return eventDate >= start && eventDate <= end;
                });
            }

            res.json({
                success: true,
                data: allEvents
            });
        } catch (error) {
            console.error('Error in getAllEvents:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch events',
                error: error.message
            });
        }
    }
};

module.exports = timelineEventController; 