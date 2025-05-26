const Project = require('../../models/Project');
const User = require('../../models/User');
const { createNotification } = require('../../utils/notification');
const fs = require('fs');
const path = require('path');

// Helper function to parse form data fields
const parseFormField = (field) => {
    try {
        return JSON.parse(field);
    } catch (e) {
        return field;
    }
};

const projectController = {
    async createProject(req, res) {
        try {
            console.log("body=================",req.body);
            // Parse form data fields
            const projectData = {
                name: req.body.name,
                description: req.body.description,
                projectHead: req.body.projectHead,
                members: parseFormField(req.body.members || '[]'),
                techStack: parseFormField(req.body.techStack || '[]'),
                pointOfContact: parseFormField(req.body.pointOfContact || '[]'),
                startDate: new Date(req.body.startDate),
                expectedEndDate: new Date(req.body.expectedEndDate),
                priority: req.body.priority || 'medium',
                status: req.body.status || 'planning',
                createdBy: req.user._id
            };

            // Validate required fields
            if (!projectData.name || !projectData.projectHead || !projectData.description) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required fields' 
                });
            }

            // Handle file uploads
            if (req.files?.length > 0) {
                projectData.files = req.files.map(file => ({
                    name: file.originalname,
                    filedata: file.path,
                    filetype: file.mimetype,
                    uploadDate: new Date()
                }));
            }

            // Create project with initial pipeline
            projectData.pipeline = {
                requirementGathering: { status: 'pending' },
                architectCreation: { status: 'pending' },
                architectSubmission: { status: 'pending' },
                developmentPhases: []
            };
            console.log("projectData=================",projectData);
            const project = new Project(projectData);
            await project.save();

            // Add project reference to project head and members
            await User.findByIdAndUpdate(project.projectHead, {
                $addToSet: { projects: project._id }
            });

            if (project.members?.length > 0) {
                await User.updateMany(
                    { _id: { $in: project.members } },
                    { $addToSet: { projects: project._id } }
                );
            }

            // Send notifications
            await createNotification({
                userId: project.projectHead,
                type: 'project_assignment',
                message: `You have been assigned as project head for ${project.name}`,
                reference: {
                    type: 'project',
                    id: project._id
                }
            });

            if (project.members?.length > 0) {
                await Promise.all(project.members.map(memberId =>
                    createNotification({
                        userId: memberId,
                        type: 'project_assignment',
                        message: `You have been assigned to project ${project.name}`,
                        reference: {
                            type: 'project',
                            id: project._id
                        }
                    })
                ));
            }

            res.status(201).json({
                success: true,
                data: project
            });
        } catch (error) {
            console.error('Project creation error:', error);
            // Clean up uploaded files if project creation fails
            if (req.files?.length > 0) {
                req.files.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    async updateProject(req, res) {
        try {
            const projectId = req.params.id;
            const project = await Project.findById(projectId);

            if (!project) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Project not found' 
                });
            }

            // Parse form data fields
            const updates = {
                name: req.body.name,
                description: req.body.description,
                projectHead: req.body.projectHead,
                members: parseFormField(req.body.members || '[]'),
                techStack: parseFormField(req.body.techStack || '[]'),
                pointOfContact: parseFormField(req.body.pointOfContact || '[]'),
                priority: req.body.priority,
                status: req.body.status
            };

            // Remove undefined fields
            Object.keys(updates).forEach(key => {
                if (updates[key] === undefined) {
                    delete updates[key];
                }
            });

            // Handle date fields
            if (req.body.startDate) updates.startDate = new Date(req.body.startDate);
            if (req.body.expectedEndDate) updates.expectedEndDate = new Date(req.body.expectedEndDate);

            // Handle file uploads
            if (req.files?.length > 0) {
                updates.files = req.files.map(file => ({
                    name: file.originalname,
                    filedata: file.path,
                    filetype: file.mimetype,
                    uploadDate: new Date()
                }));

                // Remove old files
                if (project.files?.length > 0) {
                    project.files.forEach(file => {
                        if (file.filedata) {
                            fs.unlink(path.join(__dirname, '../../', file.filedata), (err) => {
                                if (err) console.error('Error deleting old file:', err);
                            });
                        }
                    });
                }
            }

            // Update member references
            if (updates.members) {
                // Remove project reference from old members
                await User.updateMany(
                    { _id: { $in: project.members } },
                    { $pull: { projects: project._id } }
                );

                // Add project reference to new members
                await User.updateMany(
                    { _id: { $in: updates.members } },
                    { $addToSet: { projects: project._id } }
                );
            }

            // Update project head reference
            if (updates.projectHead && updates.projectHead !== project.projectHead.toString()) {
                // Remove project from old project head
                await User.findByIdAndUpdate(project.projectHead, {
                    $pull: { projects: project._id }
                });

                // Add project to new project head
                await User.findByIdAndUpdate(updates.projectHead, {
                    $addToSet: { projects: project._id }
                });
            }

            const updatedProject = await Project.findByIdAndUpdate(
                projectId,
                { $set: updates },
                { 
                    new: true, 
                    runValidators: true 
                }
            )
            .populate('projectHead', 'name email')
            .populate('members', 'name email')
            .populate('createdBy', 'name email');

            res.json({
                success: true,
                data: updatedProject
            });
        } catch (error) {
            console.error('Project update error:', error);
            // Clean up uploaded files if update fails
            if (req.files?.length > 0) {
                req.files.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error('Error deleting file:', err);
                    });
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    async deleteProject(req, res) {
        try {
            const project = await Project.findByIdAndDelete(req.params.id);
            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }
            res.json({ message: 'Project deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getAllProjects(req, res) {
        try {
            const { page = 1, limit = 10, status, startDate, endDate, search } = req.query;
            const query = {};
            if (status) query.status = status;
            if (startDate && endDate) {
                query.dateCreated = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const projects = await Project.find(query)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('leadId', 'name email')
                .populate('projectOwner', 'name email')
                .populate('access', 'name email')
                .populate('assigned_to', 'name email')
                .sort({ dateCreated: -1 });

            const total = await Project.countDocuments(query);
            res.json({ projects, total, totalPages: Math.ceil(total / limit) });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getProjectById(req, res) {
        try {
            const project = await Project.findById(req.params.id)
            .populate('leadId', 'name email')
            .populate('projectOwner', 'name email')
            .populate('access', 'name email')
            .populate('assigned_to', 'name email');
            if (!project) {
                return res.status(404).json({ message: 'Project not found' });
            }
            res.json(project);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getAssignedProjects(req, res) {
        try {
            const { page = 1, limit = 10, status } = req.query;
            const query = {
                $or: [{ assigned_to: req.user.userId }, { projectOwner: req.user.userId }]
            };
            if (status) query.status = status;

            const projects = await Project.find(query)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ dateCreated: -1 });

            const total = await Project.countDocuments(query);
            res.json({ projects, total, totalPages: Math.ceil(total / limit) });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getProjects(req, res) {
        try {
            const {
                status,
                techStack,
                projectHead,
                startDate,
                endDate,
                priority
            } = req.query;

            const query = {};

            if (status) query.status = status;
            if (techStack) query.techStack = { $in: techStack.split(',') };
            if (projectHead) query.projectHead = projectHead;
            if (priority) query.priority = priority;

            if (startDate || endDate) {
                query.startDate = {};
                if (startDate) query.startDate.$gte = new Date(startDate);
                if (endDate) query.startDate.$lte = new Date(endDate);
            }

            const projects = await Project.find(query)
                .populate('projectHead', 'name email')
                .populate('members', 'name email')
                .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: projects.length,
                data: projects
            });
        } catch (error) {
            console.log('Error in getProjects:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    async getProject(req, res) {
        try {
            const project = await Project.findById(req.params.id)
                .populate('projectHead', 'name email')
                .populate('members', 'name email')
                .populate('tasks');

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            res.status(200).json({
                success: true,
                data: project
            });
        } catch (error) {
            console.log('Error in getProject:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    async updateProjectPipeline(req, res) {
        try {
            const { stage, status, startDate, endDate } = req.body;
            const project = await Project.findById(req.params.id);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Check if user has permission
            if (!project.isProjectHead(req.user._id) && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update pipeline'
                });
            }

            if (['requirementGathering', 'architectCreation', 'architectSubmission'].includes(stage)) {
                project.pipeline[stage] = {
                    status,
                    startDate: startDate || new Date(),
                    endDate
                };
            } else if (stage === 'developmentPhase') {
                const { phaseName } = req.body;
                if (!phaseName) {
                    return res.status(400).json({
                        success: false,
                        message: 'Phase name is required for development phase'
                    });
                }

                project.pipeline.developmentPhases.push({
                    phaseName,
                    status,
                    startDate: startDate || new Date(),
                    endDate
                });
            }

            await project.save();

            res.status(200).json({
                success: true,
                data: project
            });
        } catch (error) {
            console.log('Error in updateProjectPipeline:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    async getTeamMembersByTechStack(req, res) {
        try {
            const { techStack } = req.query;

            if (!techStack) {
                return res.status(400).json({
                    success: false,
                    message: 'Tech stack is required'
                });
            }

            const techStackArray = techStack.split(',');

            const users = await User.find({
                skills: { $in: techStackArray },
                status: 'active'
            }).select('name email role skills');

            res.status(200).json({
                success: true,
                count: users.length,
                data: users
            });
        } catch (error) {
            console.log('Error in getTeamMembersByTechStack:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },

    async updateProjectStatus(req, res) {
        try {
            const { status } = req.body;
            const project = await Project.findById(req.params.id);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Check if user has permission to update status
            if (!['admin', 'superadmin'].includes(req.user.role) &&
                project.projectHead.toString() !== req.user._id.toString() &&
                project.createdBy.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to update project status'
                });
            }

            // Add status change to history
            project.history.push({
                status,
                datetime: new Date(),
                updatedBy: req.user._id,
                description: `Project status changed to ${status}`
            });

            project.status = status;

            // If project is completed, set actualEndDate
            if (status === 'completed' && !project.actualEndDate) {
                project.actualEndDate = new Date();
            }

            await project.save();

            // Notify project head and members
            const notificationMessage = `Project "${project.name}" status updated to ${status}`;
            
            // Notify project head
            await createNotification({
                userId: project.projectHead,
                type: 'project_update',
                message: notificationMessage,
                reference: {
                    type: 'project',
                    id: project._id
                }
            });

            // Notify team members
            if (project.members?.length > 0) {
                await Promise.all(project.members.map(memberId =>
                    createNotification({
                        userId: memberId,
                        type: 'project_update',
                        message: notificationMessage,
                        reference: {
                            type: 'project',
                            id: project._id
                        }
                    })
                ));
            }

            res.status(200).json({
                success: true,
                data: project
            });
        } catch (error) {
            console.log('Error in updateProjectStatus:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
};

// Helper function to validate dates
const validateDates = (dates) => {
    if (!Array.isArray(dates)) return false;
    return dates.every(date => 
        date.name && 
        date.date && 
        new Date(date.date).toString() !== 'Invalid Date'
    );
};

module.exports = projectController;