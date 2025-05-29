const Project = require('../../models/Project');
const User = require('../../models/User');
const { createNotification } = require('../../utils/notification');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const Task = require('../../models/Task');

// Helper function to parse form data fields
const parseFormField = (field) => {
    try {
        return JSON.parse(field);
    } catch (e) {
        return field;
    }
};

// Add this helper function at the top with other helpers
const checkPipelinePhaseAccess = async (userId, projectId) => {
    const user = await User.findById(userId);
    const project = await Project.findById(projectId);
    
    if (!user || !project) return false;
    
    // Allow access if user is superadmin or admin
    if (user.role === 'superadmin' || user.role === 'admin') return true;
    
    // Allow access if user is manager
    if (user.role === 'manager') return true;
    
    // Allow access if user is project head
    if (project.projectHead.toString() === userId.toString()) return true;
    
    return false;
};

const updateProjectStatusBasedOnPipeline = (project) => {
    // Check if any phase is in progress
    const hasInProgressPhase = ['requirementGathering', 'architectCreation', 'architectSubmission'].some(
        stage => project.pipeline[stage]?.status === 'in-progress'
    ) || project.pipeline.developmentPhases?.some(phase => phase.status === 'in-progress');

    // Check if all phases are completed
    const allPhasesCompleted = ['requirementGathering', 'architectCreation', 'architectSubmission'].every(
        stage => project.pipeline[stage]?.status === 'completed'
    ) && (!project.pipeline.developmentPhases?.length || 
          project.pipeline.developmentPhases.every(phase => phase.status === 'completed'));

    // Check if any phase has started (is either in-progress or completed)
    const hasStartedPhase = ['requirementGathering', 'architectCreation', 'architectSubmission'].some(
        stage => ['in-progress', 'completed'].includes(project.pipeline[stage]?.status)
    ) || project.pipeline.developmentPhases?.some(phase => ['in-progress', 'completed'].includes(phase.status));

    // Only update status if not manually set to stopped or cancelled
    if (!['stopped', 'cancelled'].includes(project.status)) {
        if (allPhasesCompleted) {
            project.status = 'completed';
        } else if (hasInProgressPhase) {
            project.status = 'on-progress';
        } else if (hasStartedPhase && project.status === 'created') {
            project.status = 'active';
        }
    }
};

const validatePipelinePhaseTransition = (project, stage, newStatus) => {
    // Get all stages in order
    const stages = [
        'requirementGathering',
        'architectCreation',
        'architectSubmission',
        ...project.pipeline.developmentPhases.map((_, index) => `development${index}`)
    ];

    const currentStageIndex = stages.indexOf(stage);
    if (currentStageIndex === -1) return false;

    // If starting a new phase
    if (newStatus === 'in-progress') {
        // First phase can always be started
        if (currentStageIndex === 0) return true;

        // For other phases, check if previous phase is completed
        const previousStage = stages[currentStageIndex - 1];
        if (previousStage.startsWith('development')) {
            const phaseIndex = parseInt(previousStage.replace('development', ''));
            return project.pipeline.developmentPhases[phaseIndex]?.status === 'completed';
        }
        return project.pipeline[previousStage]?.status === 'completed';
    }

    return true;
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
                startDate: new Date(parseFormField(req.body.startDate)),
                endDate: new Date(parseFormField(req.body.endDate)),
                priority: req.body.priority || 'medium',
                status: 'created',
                createdBy: req.user._id,
                pipeline: {
                    requirementGathering: {
                        status: 'pending'
                    },
                    architectCreation: {
                        status: 'pending'
                    },
                    architectSubmission: {
                        status: 'pending'
                    },
                    developmentPhases: []
                }
            };

            // Add initial development phase if provided
            if (req.body.developmentPhases) {
                const phases = parseFormField(req.body.developmentPhases);
                if (Array.isArray(phases)) {
                    projectData.pipeline.developmentPhases = phases.map(phase => ({
                        phaseName: phase.name,
                        status: 'pending',
                        startDate: new Date(phase.startDate),
                        endDate: new Date(phase.endDate)
                    }));
                }
            }

            // Validate required fields
            if (!projectData.name || !projectData.projectHead || !projectData.description) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Missing required fields' 
                });
            }

            // Validate dates
            if (isNaN(projectData.startDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid start date'
                });
            }

            if (isNaN(projectData.endDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid end date'
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
            try {
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
            } catch (notificationError) {
                // Log notification error but don't fail the project creation
                logger.error('Failed to send project notifications:', notificationError);
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
                status: req.body.status,
                updatedBy: req.user._id,
                updatedAt: new Date()
            };

            // Handle pipeline updates
            if (req.body.pipeline) {
                const pipelineData = parseFormField(req.body.pipeline);
                
                // Update fixed stages
                ['requirementGathering', 'architectCreation', 'architectSubmission'].forEach(stage => {
                    if (pipelineData[stage]?.status) {
                        if (!project.pipeline) project.pipeline = {};
                        if (!project.pipeline[stage]) project.pipeline[stage] = {};
                        
                        project.pipeline[stage].status = pipelineData[stage].status;
                        if (pipelineData[stage].status === 'completed') {
                            project.pipeline[stage].completedAt = new Date();
                        }
                    }
                });

                // Update development phases
                if (pipelineData.developmentPhases) {
                    project.pipeline.developmentPhases = pipelineData.developmentPhases.map(phase => ({
                        phaseName: phase.name,
                        status: phase.status || 'pending',
                        startDate: new Date(phase.startDate),
                        endDate: new Date(phase.endDate),
                        completedAt: phase.status === 'completed' ? new Date() : undefined
                    }));
                }

                updates.pipeline = project.pipeline;
            }

            // Handle date fields
            if (req.body.startDate) {
                const startDate = new Date(req.body.startDate);
                if (isNaN(startDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid start date'
                    });
                }
                updates.startDate = startDate;
            }

            if (req.body.endDate) {
                const endDate = new Date(req.body.endDate);
                if (isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid end date'
                    });
                }
                updates.endDate = endDate;
            }

            // Remove undefined fields
            Object.keys(updates).forEach(key => {
                if (updates[key] === undefined) {
                    delete updates[key];
                }
            });

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
                const oldMembers = project.members.map(id => id.toString());
                const newMembers = updates.members.map(id => id.toString());

                // Find members to remove and add
                const membersToRemove = oldMembers.filter(id => !newMembers.includes(id));
                const membersToAdd = newMembers.filter(id => !oldMembers.includes(id));

                // Remove project reference from old members
                if (membersToRemove.length > 0) {
                    await User.updateMany(
                        { _id: { $in: membersToRemove } },
                        { $pull: { projects: project._id } }
                    );
                }

                // Add project reference to new members
                if (membersToAdd.length > 0) {
                    await User.updateMany(
                        { _id: { $in: membersToAdd } },
                        { $addToSet: { projects: project._id } }
                    );

                    // Send notifications to new members
                    try {
                        await Promise.all(membersToAdd.map(memberId =>
                            createNotification({
                                userId: memberId,
                                type: 'project_assignment',
                                message: `You have been added to project ${project.name}`,
                                reference: {
                                    type: 'project',
                                    id: project._id
                                }
                            })
                        ));
                    } catch (notificationError) {
                        console.error('Failed to send member addition notifications:', notificationError);
                    }
                }
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

                // Send notification to new project head
                try {
                    await createNotification({
                        userId: updates.projectHead,
                        type: 'project_head_assignment',
                        message: `You have been assigned as project head for ${project.name}`,
                        reference: {
                            type: 'project',
                            id: project._id
                        }
                    });
                } catch (notificationError) {
                    console.error('Failed to send project head notification:', notificationError);
                }
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
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

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

            // Build query filters
            if (status) query.status = status;
            if (startDate && endDate) {
                query.startDate = { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                };
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Execute query with proper population
            const projects = await Project.find(query)
                .populate('projectHead', 'name email')
                .populate('members', 'name email')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip((parseInt(page) - 1) * parseInt(limit))
                .limit(parseInt(limit));

            // Get total count for pagination
            const total = await Project.countDocuments(query);

            res.status(200).json({
                success: true,
                data: {
                    projects,
                    total,
                    totalPages: Math.ceil(total / parseInt(limit)),
                    currentPage: parseInt(page)
                }
            });
        } catch (error) {
            console.error('Error in getAllProjects:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch projects',
                error: error.message
            });
        }
    },

    async getProjectById(req, res) {
        try {
            const project = await Project.findById(req.params.id)
                .populate('projectHead', 'name email photo')
                .populate('members', 'name email photo')
                .populate('createdBy', 'name email')
                .populate({
                    path: 'tasks',
                    populate: {
                        path: 'assignedTo',
                        select: 'name photo'
                    }
                });

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
            console.error('Error in getProjectById:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project details',
                error: error.message
            });
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
                .populate('projectHead', 'name email photo')
                .populate('members', 'name email photo')
                .populate('createdBy', 'name email')
                .populate({
                    path: 'tasks',
                    populate: {
                        path: 'assignedTo',
                        select: 'name photo'
                    }
                });

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
            console.error('Error in getProject:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project details',
                error: error.message
            });
        }
    },

    async updateProjectPipeline(req, res) {
        try {
            const { id } = req.params;
            const { stage, status } = req.body;

            // Validate required fields
            if (!stage || !status) {
                return res.status(400).json({
                    success: false,
                    message: 'Stage and status are required'
                });
            }

            // Validate status value
            const validStatuses = ['pending', 'in-progress', 'completed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const project = await Project.findById(id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Initialize pipeline if it doesn't exist
            if (!project.pipeline) {
                project.pipeline = {
                    requirementGathering: { status: 'pending' },
                    architectCreation: { status: 'pending' },
                    architectSubmission: { status: 'pending' },
                    developmentPhases: []
                };
            }

            // Update the stage status
            if (stage.startsWith('developmentPhase-')) {
                const phaseIndex = parseInt(stage.replace('developmentPhase-', ''));
                if (isNaN(phaseIndex) || !project.pipeline.developmentPhases[phaseIndex]) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid development phase index'
                    });
                }
                project.pipeline.developmentPhases[phaseIndex].status = status;
                if (status === 'completed') {
                    project.pipeline.developmentPhases[phaseIndex].completedAt = new Date();
                }
            } else {
                if (!project.pipeline[stage]) {
                    project.pipeline[stage] = {};
                }
                project.pipeline[stage].status = status;
                if (status === 'completed') {
                    project.pipeline[stage].completedAt = new Date();
                }
            }

            // Update project status based on pipeline
            updateProjectStatusBasedOnPipeline(project);

            await project.save();

            // Create notification for status change
            try {
                await createNotification({
                    userId: project.projectHead,
                    type: 'pipeline_update',
                    message: `Project ${project.name} pipeline stage ${stage} has been updated to ${status}`,
                    reference: {
                        type: 'project',
                        id: project._id
                    }
                });
            } catch (notificationError) {
                console.error('Failed to send pipeline update notification:', notificationError);
            }

            res.json({
                success: true,
                data: project
            });
        } catch (error) {
            console.error('Error updating project pipeline:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update project pipeline',
                error: error.message
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
            const { id } = req.params;
            const { status, reason } = req.body;

            // Validate status
            const validStatuses = ['created', 'active', 'on-progress', 'stopped', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}`
                });
            }

            const project = await Project.findById(id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Validate status transitions
            const isValidTransition = (() => {
                switch (status) {
                    case 'active':
                        return project.status === 'created';
                    case 'on-progress':
                        // This should only be set automatically by pipeline updates
                        return false;
                    case 'stopped':
                    case 'cancelled':
                        // Can be set from any status except completed
                        return project.status !== 'completed';
                    case 'completed':
                        // Should only be set automatically when all pipeline stages are completed
                        return false;
                    default:
                        return false;
                }
            })();

            if (!isValidTransition) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status transition'
                });
            }

            // Store old status for history
            const oldStatus = project.status;

            // Update project status and set updatedBy
            project.status = status;
            project.updatedBy = req.user._id;
            project.updatedAt = new Date();

            // Add status change to history
            const historyEntry = {
                status,
                datetime: new Date(),
                updatedBy: req.user._id,
                description: `Project status changed from ${oldStatus} to ${status}`
            };

            if (reason) {
                historyEntry.description += ` (Reason: ${reason})`;
            }

            project.history.push(historyEntry);

            await project.save();

            // Populate necessary fields for response
            await project.populate([
                { path: 'projectHead', select: 'name photo' },
                { path: 'members', select: 'name photo' },
                { path: 'history.updatedBy', select: 'name photo' }
            ]);

            // Send notifications to project members
            try {
                const notificationMessage = `Project "${project.name}" status changed to ${status}`;
                const notificationPromises = [project.projectHead, ...project.members].map(user =>
                    createNotification({
                        userId: user._id,
                        type: 'status_change',
                        message: notificationMessage,
                        reference: {
                            type: 'project',
                            id: project._id
                        }
                    })
                );
                await Promise.all(notificationPromises);
            } catch (notificationError) {
                console.error('Failed to send status change notifications:', notificationError);
            }

            res.status(200).json({
                success: true,
                data: project
            });
        } catch (error) {
            console.error('Error in updateProjectStatus:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update project status',
                error: error.message
            });
        }
    },

    // Project Tasks
    async getProjectTasks(req, res) {
      
        try {
            console.log("getProjectTasks", req.params.id);
            const project = await Project.findById(req.params.id)
                .populate({
                    path: 'tasks',
                    populate: {
                        path: 'assignedTo',
                        select: 'name photo'
                    }
                });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }
            console.log("project", project);

            res.status(200).json({
                success: true,
                data: project.tasks || []
            });
        } catch (error) {
            console.error('Error in getProjectTasks:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project tasks',
                error: error.message
            });
        }
    },

    async createProjectTask(req, res) {
        try {
            const project = await Project.findById(req.params.id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const taskData = {
                ...req.body,
                project: project._id,
                createdBy: req.user._id
            };

            const task = new Task(taskData);
            await task.save();

            project.tasks.push(task._id);
            await project.save();

            // Send notification to assigned user
            if (task.assignedTo) {
                await createNotification({
                    userId: task.assignedTo,
                    type: 'task_assignment',
                    message: `You have been assigned a new task in project ${project.name}`,
                    reference: {
                        type: 'task',
                        id: task._id
                    }
                });
            }

            res.status(201).json({
                success: true,
                data: task
            });
        } catch (error) {
            console.error('Error in createProjectTask:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create task',
                error: error.message
            });
        }
    },

    async updateProjectTask(req, res) {
        try {
            const { id, taskId } = req.params;
            const project = await Project.findById(id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const task = await Task.findOneAndUpdate(
                { _id: taskId, project: id },
                { ...req.body, updatedBy: req.user._id },
                { new: true }
            ).populate('assignedTo', 'name photo');

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found'
                });
            }

            res.status(200).json({
                success: true,
                data: task
            });
        } catch (error) {
            console.error('Error in updateProjectTask:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update task',
                error: error.message
            });
        }
    },

    async deleteProjectTask(req, res) {
        try {
            const { id, taskId } = req.params;
            const project = await Project.findById(id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const task = await Task.findOneAndDelete({ _id: taskId, project: id });
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found'
                });
            }

            project.tasks = project.tasks.filter(t => t.toString() !== taskId);
            await project.save();

            res.status(200).json({
                success: true,
                message: 'Task deleted successfully'
            });
        } catch (error) {
            console.error('Error in deleteProjectTask:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete task',
                error: error.message
            });
        }
    },

    // Project Team
    async getProjectMembers(req, res) {
        try {
            const project = await Project.findById(req.params.id)
                .populate('members', 'name email photo role')
                .populate('projectHead', 'name email photo role');

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            const team = {
                projectHead: project.projectHead,
                members: project.members || []
            };

            res.status(200).json({
                success: true,
                data: team
            });
        } catch (error) {
            console.error('Error in getProjectMembers:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch team members',
                error: error.message
            });
        }
    },

    async addProjectMembers(req, res) {
        try {
            const { members } = req.body;
            const project = await Project.findById(req.params.id);
            
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Add new members
            project.members = [...new Set([...project.members, ...members])];
            await project.save();

            // Add project reference to new members
            await User.updateMany(
                { _id: { $in: members } },
                { $addToSet: { projects: project._id } }
            );

            // Send notifications to new members
            await Promise.all(members.map(memberId =>
                createNotification({
                    userId: memberId,
                    type: 'project_assignment',
                    message: `You have been added to project ${project.name}`,
                    reference: {
                        type: 'project',
                        id: project._id
                    }
                })
            ));

            const updatedProject = await Project.findById(req.params.id)
                .populate('members', 'name email photo role');

            res.status(200).json({
                success: true,
                data: updatedProject.members
            });
        } catch (error) {
            console.error('Error in addProjectMembers:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add team members',
                error: error.message
            });
        }
    },

    async removeProjectMember(req, res) {
        try {
            const { id, memberId } = req.params;
            const project = await Project.findById(id);
            
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Remove member from project
            project.members = project.members.filter(m => m.toString() !== memberId);
            await project.save();

            // Remove project reference from user
            await User.findByIdAndUpdate(memberId, {
                $pull: { projects: project._id }
            });

            res.status(200).json({
                success: true,
                message: 'Team member removed successfully'
            });
        } catch (error) {
            console.error('Error in removeProjectMember:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove team member',
                error: error.message
            });
        }
    },

    async updateMemberRole(req, res) {
        try {
            const { id, memberId } = req.params;
            const { role } = req.body;
            
            const project = await Project.findById(id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Update member's role in project
            const memberIndex = project.members.findIndex(m => m.toString() === memberId);
            if (memberIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Member not found in project'
                });
            }

            project.memberRoles = project.memberRoles || {};
            project.memberRoles[memberId] = role;
            await project.save();

            res.status(200).json({
                success: true,
                message: 'Member role updated successfully'
            });
        } catch (error) {
            console.error('Error in updateMemberRole:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update member role',
                error: error.message
            });
        }
    },

    // Project Timeline
    async getProjectTimeline(req, res) {
        try {
            const project = await Project.findById(req.params.id)
                .populate('timeline.createdBy', 'name photo');

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            res.status(200).json({
                success: true,
                data: project.timeline || []
            });
        } catch (error) {
            console.error('Error in getProjectTimeline:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch timeline',
                error: error.message
            });
        }
    },

    async addTimelineEvent(req, res) {
        try {
            const { title, description, date, type, status } = req.body;

            if (!title || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'Title and date are required'
                });
            }

            const project = await Project.findById(req.params.id);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            project.timeline.push({
                title,
                description,
                date,
                type,
                status,
                createdBy: req.user._id
            });

            await project.save();

            const updatedEvent = project.timeline[project.timeline.length - 1];
            await Project.populate(updatedEvent, {
                path: 'createdBy',
                select: 'name photo'
            });

            res.status(201).json({
                success: true,
                data: updatedEvent
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
            const { title, description, date, type, status } = req.body;
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

            if (title) event.title = title;
            if (description) event.description = description;
            if (date) event.date = date;
            if (type) event.type = type;
            if (status) event.status = status;

            await project.save();

            await Project.populate(event, {
                path: 'createdBy',
                select: 'name photo'
            });

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

    async getProjectStats(req, res) {
        try {
            const [
                totalActive,
                totalInProgress,
                totalCompleted,
                totalDelayed,
                totalProjects,
                totalMembers,
                upcomingDeadlines,
                recentUpdates
            ] = await Promise.all([
                Project.countDocuments({ status: 'active' }),
                Project.countDocuments({ 
                    status: { $in: ['planning', 'active'] },
                    'pipeline.developmentPhases': { 
                        $elemMatch: { 
                            status: 'in-progress'
                        }
                    }
                }),
                Project.countDocuments({ status: 'completed' }),
                Project.countDocuments({
                    status: { $ne: 'completed' },
                    endDate: { $lt: new Date() }
                }),
                Project.countDocuments(),
                Project.aggregate([
                    { $unwind: '$members' },
                    { $group: { _id: null, count: { $addToSet: '$members' } } },
                    { $project: { count: { $size: '$count' } } }
                ]),
                Project.find({
                    status: { $ne: 'completed' },
                    endDate: { 
                        $gte: new Date(),
                        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
                    }
                }).select('name endDate').limit(5),
                Project.find()
                    .sort({ updatedAt: -1 })
                    .limit(5)
                    .populate('updatedBy', 'name photo')
                    .select('name updatedAt updatedBy')
            ]);

            res.status(200).json({
                success: true,
                stats: {
                    active: totalActive,
                    inProgress: totalInProgress,
                    completed: totalCompleted,
                    delayed: totalDelayed,
                    total: totalProjects,
                    totalMembers: totalMembers?.[0]?.count || 0,
                    upcomingDeadlines,
                    recentUpdates
                }
            });
        } catch (error) {
            console.error('Error getting project stats:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting project statistics',
                error: error.message
            });
        }
    },

    async assignTasksToTeam(req, res) {
        try {
            const { id } = req.params;
            const { tasks } = req.body;

            const project = await Project.findById(id)
                .populate('members', 'name email');

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: 'Project not found'
                });
            }

            // Validate tasks array
            if (!Array.isArray(tasks) || tasks.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tasks array is required'
                });
            }

            // Validate each task has required fields and assignees
            for (const task of tasks) {
                if (!task.description || !task.assignees || !Array.isArray(task.assignees) || task.assignees.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each task must have description and assignees'
                    });
                }

                // Verify all assignees are project members
                const invalidAssignees = task.assignees.filter(
                    assigneeId => !project.members.some(member => member._id.toString() === assigneeId)
                );

                if (invalidAssignees.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Some assignees are not project members'
                    });
                }
            }

            // Initialize tasks array if it doesn't exist
            if (!project.tasks) {
                project.tasks = [];
            }

            // Create tasks and assign to team members
            const createdTasks = [];
            for (const task of tasks) {
                const taskPromises = task.assignees.map(async (assigneeId) => {
                    const taskData = {
                        description: task.description,
                        project: project._id,
                        createdBy: req.user._id,
                        assignedTo: assigneeId,
                        deadline: task.deadline || null,
                        priority: task.priority || 'Medium',
                        isDaily: task.isDaily || false,
                        status: 'Assigned'
                    };

                    const newTask = new Task(taskData);
                    await newTask.save();

                    // Add task to project's tasks array
                    project.tasks.push(newTask._id);

                    // Send notification to assigned user
                    await createNotification({
                        userId: assigneeId,
                        type: 'task_assignment',
                        message: `You have been assigned a new task in project ${project.name}`,
                        reference: {
                            type: 'task',
                            id: newTask._id
                        }
                    });

                    return newTask;
                });

                const taskResults = await Promise.all(taskPromises);
                createdTasks.push(...taskResults);
            }

            // Save project with new tasks
            await project.save();

            // Populate task details
            const populatedTasks = await Task.find({
                _id: { $in: createdTasks.map(task => task._id) }
            })
            .populate('assignedTo', 'name photo')
            .populate('createdBy', 'name');

            res.status(201).json({
                success: true,
                message: 'Tasks assigned successfully',
                data: populatedTasks
            });
        } catch (error) {
            console.error('Error in assignTasksToTeam:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to assign tasks',
                error: error.message
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