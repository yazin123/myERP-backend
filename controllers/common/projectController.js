const Project = require('../../models/Project');
const ProjectUpdate = require('../../models/ProjectUpdate');
const ProjectSubscription = require('../../models/ProjectSubscription');
const logger = require('../../utils/logger');
const notificationService = require('../../utils/notification');

const projectController = {
    // Get user's projects
    getMyProjects: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                search,
                sortBy = 'startDate',
                order = 'desc'
            } = req.query;

            const query = {
                $or: [
                    { members: req.user._id },
                    { manager: req.user._id },
                    { createdBy: req.user._id }
                ]
            };

            if (status) query.status = status;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const sortOption = {};
            sortOption[sortBy] = order === 'desc' ? -1 : 1;

            const projects = await Project.find(query)
                .populate('manager', 'name photo')
                .populate('members', 'name photo')
                .populate('createdBy', 'name')
                .sort(sortOption)
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Project.countDocuments(query);

            res.json({
                projects,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total
            });
        } catch (error) {
            logger.error('Get my projects error:', error);
            res.status(500).json({ message: 'Failed to fetch projects' });
        }
    },

    // Get project by ID
    getProjectById: async (req, res) => {
        try {
            const project = await Project.findOne({
                _id: req.params.id,
                $or: [
                    { members: req.user._id },
                    { manager: req.user._id },
                    { createdBy: req.user._id }
                ]
            })
            .populate('manager', 'name photo email')
            .populate('members', 'name photo')
            .populate('createdBy', 'name')
            .populate('tasks')
            .populate({
                path: 'updates',
                populate: {
                    path: 'user',
                    select: 'name photo'
                }
            });

            if (!project) {
                return res.status(404).json({ message: 'Project not found or access denied' });
            }

            // Check if user is subscribed
            const subscription = await ProjectSubscription.findOne({
                project: project._id,
                user: req.user._id
            });

            project._doc.isSubscribed = !!subscription;

            res.json(project);
        } catch (error) {
            logger.error('Get project by ID error:', error);
            res.status(500).json({ message: 'Failed to fetch project details' });
        }
    },

    // Add project update
    addProjectUpdate: async (req, res) => {
        try {
            const project = await Project.findOne({
                _id: req.params.id,
                $or: [
                    { members: req.user._id },
                    { manager: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!project) {
                return res.status(404).json({ message: 'Project not found or access denied' });
            }

            const update = new ProjectUpdate({
                project: project._id,
                user: req.user._id,
                content: req.body.content,
                type: req.body.type || 'general'
            });

            await update.save();
            project.updates.push(update._id);
            await project.save();

            // Notify subscribed users
            const subscriptions = await ProjectSubscription.find({ project: project._id });
            for (const subscription of subscriptions) {
                if (subscription.user.toString() !== req.user._id.toString()) {
                    await notificationService.sendNotification({
                        type: 'PROJECT_UPDATE',
                        user: subscription.user,
                        data: {
                            projectId: project._id,
                            projectName: project.name,
                            updateType: update.type,
                            updatedBy: req.user.name
                        }
                    });
                }
            }

            await update.populate('user', 'name photo');
            res.json(update);
        } catch (error) {
            logger.error('Add project update error:', error);
            res.status(500).json({ message: 'Failed to add project update' });
        }
    },

    // Get project updates
    getProjectUpdates: async (req, res) => {
        try {
            const project = await Project.findOne({
                _id: req.params.id,
                $or: [
                    { members: req.user._id },
                    { manager: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!project) {
                return res.status(404).json({ message: 'Project not found or access denied' });
            }

            const updates = await ProjectUpdate.find({ project: project._id })
                .populate('user', 'name photo')
                .sort({ createdAt: -1 });

            res.json(updates);
        } catch (error) {
            logger.error('Get project updates error:', error);
            res.status(500).json({ message: 'Failed to fetch project updates' });
        }
    },

    // Subscribe to project
    subscribeToProject: async (req, res) => {
        try {
            const project = await Project.findOne({
                _id: req.params.id,
                $or: [
                    { members: req.user._id },
                    { manager: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!project) {
                return res.status(404).json({ message: 'Project not found or access denied' });
            }

            let subscription = await ProjectSubscription.findOne({
                project: project._id,
                user: req.user._id
            });

            if (subscription) {
                return res.status(400).json({ message: 'Already subscribed to this project' });
            }

            subscription = new ProjectSubscription({
                project: project._id,
                user: req.user._id
            });

            await subscription.save();
            res.json({ message: 'Subscribed to project successfully' });
        } catch (error) {
            logger.error('Subscribe to project error:', error);
            res.status(500).json({ message: 'Failed to subscribe to project' });
        }
    },

    // Unsubscribe from project
    unsubscribeFromProject: async (req, res) => {
        try {
            const subscription = await ProjectSubscription.findOne({
                project: req.params.id,
                user: req.user._id
            });

            if (!subscription) {
                return res.status(404).json({ message: 'Subscription not found' });
            }

            await subscription.deleteOne();
            res.json({ message: 'Unsubscribed from project successfully' });
        } catch (error) {
            logger.error('Unsubscribe from project error:', error);
            res.status(500).json({ message: 'Failed to unsubscribe from project' });
        }
    }
};

module.exports = projectController; 