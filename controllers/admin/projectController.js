const Project = require('../../models/Project');
const fs = require('fs');
const path = require('path');

const projectController = {
    async createProject(req, res) {
        console.log('Request Body:', req.body);
        console.log('Request Files:', req.files);

        try {
            // Parse filesMetadata from the request body
            const filesMetadata = JSON.parse(req.body.filesMetadata || '[]');

            // Map files to the correct structure
            const files = req.files ? req.files.map((file, index) => ({
                name: filesMetadata[index]?.name || file.originalname,
                filedata: file.path,
                filetype: filesMetadata[index]?.filetype || file.mimetype,
            })) : [];

            // Prepare project data
            const projectData = {
                ...req.body,
                projectOwner: req.user.userId,
                createdBy: req.user.userId,
                files: files,
                statusHistory: [{
                    status: req.body.status,
                    description: 'Project created',
                    createdBy: req.user.userId,
                }],
            };

            // Create the project
            const project = await Project.create(projectData);
            res.status(201).json(project);
        } catch (error) {
            console.error('Error creating project:', error);
            res.status(400).json({ error: error.message });
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
                            if (err) console.error('Error deleting file:', err);
                        });
                    }
                });
            }
    
            res.json(updatedProject);
        } catch (error) {
            console.error('Error updating project:', error);
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
    }
};

module.exports = projectController;