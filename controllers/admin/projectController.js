const Project = require('../../models/Project');
const User = require('../../models/User');
const { createNotification } = require('../../utils/notification');
const fs = require('fs');
const path = require('path');

const projectController = {
    async createProject(req, res) {
        console.log('Request Body:', req.body);
        console.log('Request Files:', req.files);

        try {
            const {
                name,
                pointOfContact,
                projectHead,
                members,
                description,
                techStack,
                dates,
                pipeline
            } = req.body;

            // Validate required fields
            if (!name || !projectHead || !description || !techStack || !dates) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required fields' 
                });
            }

            // Validate dates
            if (!validateDates(dates)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid dates format' 
                });
            }

            // Check if project head exists and has appropriate role
            const headUser = await User.findById(projectHead);
            if (!headUser || !['teamlead', 'projectmanager'].includes(headUser.role)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid project head' 
                });
            }

            // Create project
            const project = new Project({
                name,
                pointOfContact,
                projectHead,
                members: members || [],
                description,
                techStack,
                dates,
                pipeline: {
                    requirementGathering: { status: 'pending' },
                    architectCreation: { status: 'pending' },
                    architectSubmission: { status: 'pending' },
                    developmentPhases: []
                },
                createdBy: req.user._id
            });

            await project.save();

            // Notify project head and members
            await createNotification({
                userId: projectHead,
                type: 'project_assignment',
                message: `You have been assigned as project head for ${name}`,
                reference: {
                    type: 'project',
                    id: project._id
                }
            });

            if (members && members.length > 0) {
                await Promise.all(members.map(memberId =>
                    createNotification({
                        userId: memberId,
                        type: 'project_assignment',
                        message: `You have been assigned to project ${name}`,
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
            console.log('Error in createProject:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    },
    async updateProject(req, res) {
        try {
            const { 
                id, // Get id from request body
                title, 
                description, 
                leadId, 
                status, 
                statusDescription, 
                completionDate,
                access,
                assigned_to
            } = req.body;
    
            // Validate if id exists
            if (!id) {
                return res.status(400).json({ error: 'Project ID is required' });
            }
    
            const updateData = {};
    
            // Handle basic fields if they exist
            if (title) updateData.title = title;
            if (description) updateData.description = description;
            if (leadId) updateData.leadId = leadId;
            if (completionDate) updateData.completionDate = new Date(completionDate);
            if (access) updateData.access = access;
            if (assigned_to) updateData.assigned_to = assigned_to;
    
            // Handle status update with required description
            if (status) {
                if (!statusDescription) {
                    return res.status(400).json({ 
                        error: 'Status description is required when updating status' 
                    });
                }
                updateData.status = status;
                updateData.$push = {
                    statusHistory: {
                        status,
                        description: statusDescription,
                        createdBy: req.user.userId,
                        timestamp: new Date()
                    }
                };
            }
    
            // Handle file updates
            if (req.files && req.files.length > 0) {
                const filesMetadata = JSON.parse(req.body.filesMetadata || '[]');
                const newFiles = req.files.map((file, index) => ({
                    name: filesMetadata[index]?.name || file.originalname,
                    filedata: file.path,
                    filetype: file.mimetype
                }));
    
                // If existing files were provided in the update
                if (req.body.existingFiles) {
                    const existingFiles = JSON.parse(req.body.existingFiles);
                    updateData.files = [...existingFiles, ...newFiles];
                } else {
                    // Get current project to maintain existing files
                    const project = await Project.findById(id);
                    updateData.files = [...(project.files || []), ...newFiles];
                }
            } else if (req.body.existingFiles) {
                // Only update existing files without adding new ones
                updateData.files = JSON.parse(req.body.existingFiles);
            }
    
            // Update the project
            const updatedProject = await Project.findByIdAndUpdate(
                id, // Use id from request body
                updateData,
                { 
                    new: true,
                    runValidators: true 
                }
            ).populate('leadId', 'name email')
             .populate('projectOwner', 'name email')
             .populate('access', 'name email')
             .populate('assigned_to', 'name email');
    
            if (!updatedProject) {
                return res.status(404).json({ message: 'Project not found' });
            }
    
            // Clean up removed files if files were updated
            if (updateData.files) {
                const project = await Project.findById(id);
                const oldFiles = project.files || [];
                const newFiles = updateData.files;
                
                // Find files that were removed
                const removedFiles = oldFiles.filter(oldFile => 
                    !newFiles.some(newFile => newFile.filedata === oldFile.filedata)
                );
    
                // Delete removed files from storage
                removedFiles.forEach(file => {
                    if (file.filedata) {
                        const filePath = path.join(__dirname, '../../', file.filedata);
                        fs.unlink(filePath, err => {
                            if (err) console.log('Error deleting file:', err);
                        });
                    }
                });
            }
    
            res.json(updatedProject);
        } catch (error) {
            console.log('Error updating project:', error);
            res.status(400).json({ error: error.message });
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