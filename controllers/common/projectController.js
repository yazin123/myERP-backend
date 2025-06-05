const Project = require('../../models/Project');
const ProjectUpdate = require('../../models/ProjectUpdate');
const logger = require('../../utils/logger');
const notificationService = require('../../utils/notification');
const Task = require('../../models/Task');
const User = require('../../models/User');
const { validateProject } = require('../../utils/validation');
const { ApiError } = require('../../utils/errors');
const { uploadFile, deleteFile } = require('../../utils/fileStorage');

const projectController = {
    // Get user's projects
    getMyProjects: async (req, res) => {
        try {
            const userId = req.user._id;

            const projects = await Project.find({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ]
            })
            .populate('projectHead', 'name photo')
            .populate('members', 'name photo')
            .populate('timeline')
            .sort({ startDate: 1 });

            res.json({
                success: true,
                data: projects
            });
        } catch (error) {
            logger.error('Get my projects error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch projects',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
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

            // Notify project members
            const notifyUsers = project.members.filter(
                memberId => memberId.toString() !== req.user._id.toString()
            );

            for (const userId of notifyUsers) {
                await notificationService.sendNotification({
                    type: 'PROJECT_UPDATE',
                    user: userId,
                    data: {
                        projectId: project._id,
                        projectName: project.name,
                        updateType: update.type,
                        updatedBy: req.user.name
                    }
                });
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

    // Get all projects with filtering options
    getProjects: async (req, res, next) => {
        try {
            const {
                status,
                priority,
                manager,
                department,
                startDate,
                endDate,
                search,
                teamMember
            } = req.query;

            // Build query
            const query = {};
            
            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (manager) query.manager = manager;
            if (department) query.department = department;
            
            // Date range
            if (startDate || endDate) {
                query.startDate = {};
                if (startDate) query.startDate.$gte = new Date(startDate);
                if (endDate) query.startDate.$lte = new Date(endDate);
            }

            // Search in name and description
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Team member filter
            if (teamMember) {
                query.members = teamMember;
            }

            const projects = await Project.find(query)
                .populate('manager', 'name email photo')
                .populate('members', 'name photo')
                .populate('department', 'name')
                .sort({ createdAt: -1 });

            res.json(projects);
        } catch (error) {
            next(error);
        }
    },

    // Create new project
    createProject: async (req, res, next) => {
        try {
            const { error } = validateProject(req.body);
            if (error) {
                throw new ApiError(400, error.details[0].message);
            }

            const project = new Project({
                ...req.body,
                createdBy: req.user._id
            });

            await project.save();

            // Populate references
            await project.populate([
                { path: 'manager', select: 'name email' },
                { path: 'department', select: 'name' },
                { path: 'team.user', select: 'name email' }
            ]);

            res.status(201).json(project);
        } catch (error) {
            next(error);
        }
    },

    // Update project
    updateProject: async (req, res, next) => {
        try {
            const { error } = validateProject(req.body);
            if (error) {
                throw new ApiError(400, error.details[0].message);
            }

            const project = await Project.findByIdAndUpdate(
                req.params.projectId,
                { ...req.body, updatedAt: Date.now() },
                { new: true }
            )
            .populate('manager', 'name email')
            .populate('department', 'name')
            .populate('team.user', 'name email');

            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Delete project
    deleteProject: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            // Delete associated tasks
            await Task.deleteMany({ project: project._id });

            // Delete project documents from storage
            for (const doc of project.documents) {
                await deleteFile(doc.fileUrl);
            }

            await project.deleteOne();
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    // Add team member
    addTeamMember: async (req, res, next) => {
        try {
            const { userId, role } = req.body;

            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const user = await User.findById(userId);
            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            // Check if user is already in team
            if (project.team.some(member => member.user.equals(userId))) {
                throw new ApiError(400, 'User is already in the team');
            }

            project.team.push({
                user: userId,
                role,
                joinedAt: new Date()
            });

            await project.save();
            await project.populate('team.user', 'name email');

            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Remove team member
    removeTeamMember: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            project.team = project.team.filter(
                member => !member.user.equals(req.params.userId)
            );

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Add milestone
    addMilestone: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            project.milestones.push(req.body);
            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Update milestone
    updateMilestone: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const milestone = project.milestones.id(req.params.milestoneId);
            if (!milestone) {
                throw new ApiError(404, 'Milestone not found');
            }

            Object.assign(milestone, req.body);
            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Delete milestone
    deleteMilestone: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            project.milestones = project.milestones.filter(
                m => !m._id.equals(req.params.milestoneId)
            );

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Upload document
    uploadDocument: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const file = req.files.document;
            const fileUrl = await uploadFile(file, 'projects');

            project.documents.push({
                title: req.body.title,
                description: req.body.description,
                fileUrl,
                uploadedBy: req.user._id,
                uploadedAt: new Date()
            });

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Delete document
    deleteDocument: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const document = project.documents.id(req.params.documentId);
            if (!document) {
                throw new ApiError(404, 'Document not found');
            }

            await deleteFile(document.fileUrl);
            project.documents = project.documents.filter(
                d => !d._id.equals(req.params.documentId)
            );

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Add risk
    addRisk: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            project.risks.push({
                ...req.body,
                identifiedAt: new Date()
            });

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Update risk
    updateRisk: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const risk = project.risks.id(req.params.riskId);
            if (!risk) {
                throw new ApiError(404, 'Risk not found');
            }

            Object.assign(risk, req.body);
            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Delete risk
    deleteRisk: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            project.risks = project.risks.filter(
                r => !r._id.equals(req.params.riskId)
            );

            await project.save();
            res.json(project);
        } catch (error) {
            next(error);
        }
    },

    // Get project statistics
    getProjectStatistics: async (req, res, next) => {
        try {
            const project = await Project.findById(req.params.projectId);
            if (!project) {
                throw new ApiError(404, 'Project not found');
            }

            const tasks = await Task.find({ project: project._id });
            const taskStats = {
                total: tasks.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                inProgress: tasks.filter(t => t.status === 'in_progress').length,
                todo: tasks.filter(t => t.status === 'todo').length,
                review: tasks.filter(t => t.status === 'review').length
            };

            const milestoneStats = {
                total: project.milestones.length,
                completed: project.milestones.filter(m => m.status === 'completed').length,
                pending: project.milestones.filter(m => m.status === 'pending').length,
                delayed: project.milestones.filter(m => m.status === 'delayed').length
            };

            const riskStats = {
                total: project.risks.length,
                critical: project.risks.filter(r => r.severity === 'critical').length,
                high: project.risks.filter(r => r.severity === 'high').length,
                medium: project.risks.filter(r => r.severity === 'medium').length,
                low: project.risks.filter(r => r.severity === 'low').length,
                mitigated: project.risks.filter(r => r.status === 'mitigated').length
            };

            res.json({
                tasks: taskStats,
                milestones: milestoneStats,
                risks: riskStats,
                team: {
                    total: project.team.length,
                    roles: {
                        developer: project.team.filter(t => t.role === 'developer').length,
                        designer: project.team.filter(t => t.role === 'designer').length,
                        tester: project.team.filter(t => t.role === 'tester').length,
                        analyst: project.team.filter(t => t.role === 'analyst').length
                    }
                },
                budget: {
                    allocated: project.budget.allocated,
                    spent: project.budget.spent,
                    remaining: project.budget.allocated - project.budget.spent
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // Get project tasks
    getProjectTasks: async (req, res, next) => {
        try {
            const tasks = await Task.find({ project: req.params.projectId })
                .populate('assignee', 'name email')
                .sort({ createdAt: -1 });

            res.json(tasks);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = projectController; 