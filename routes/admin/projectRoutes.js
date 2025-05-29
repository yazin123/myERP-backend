const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate, authorize, adminAuth } = require('../../middleware/auth');
const projectController = require('../../controllers/admin/projectController');
const fs = require('fs');


// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/projects');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 
            'image/png', 
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images, PDFs, and Office documents are allowed.'), false);
        }
};

const uploadMulter = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size limit exceeded (10MB max)'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files (5 max)'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
};

// Routes
router.get('/stats', projectController.getProjectStats);
router.get('/', projectController.getAllProjects);
router.get('/filter', authenticate, projectController.getProjects);
router.get('/assigned', authenticate, projectController.getAssignedProjects);
router.get('/:id', projectController.getProjectById);

// Create and Update routes with file handling
router.post('/', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']), 
    uploadMulter.array('files'), 
    handleMulterError, 
    projectController.createProject
);

router.put('/:id', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']),
    uploadMulter.array('files'), 
    handleMulterError, 
    projectController.updateProject
);

router.delete('/:id', 
    authenticate,
    authorize(['admin', 'superadmin']), 
    projectController.deleteProject
);

// Update project status
router.patch('/:id/status', 
    authenticate,
    authorize(['admin', 'superadmin', 'manager', 'teamlead']),
    express.json(),
    projectController.updateProjectStatus
);

// Update project pipeline
router.patch('/:id/pipeline', 
    authenticate,
    authorize(['admin', 'superadmin', 'manager', 'teamlead']),
    express.json(),
    projectController.updateProjectPipeline
);

// Get team members by tech stack
router.get(
    '/team-members/tech-stack',
    authenticate,
    authorize(['admin', 'teamlead', 'projectmanager']),
    projectController.getTeamMembersByTechStack
);

// Project Tasks
router.get('/:id/tasks', 
    authenticate, 
    projectController.getProjectTasks
);

router.post('/:id/tasks', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.createProjectTask
);

router.put('/:id/tasks/:taskId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.updateProjectTask
);

router.delete('/:id/tasks/:taskId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.deleteProjectTask
);

// Team task assignment
router.post('/:id/assign-tasks',
    authenticate,
    authorize(['admin', 'superadmin', 'manager', 'teamlead']),
    projectController.assignTasksToTeam
);

// Project Team
router.get('/:id/team', 
    authenticate, 
    projectController.getProjectMembers
);

router.post('/:id/team', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']), 
    projectController.addProjectMembers
);

router.delete('/:id/team/:memberId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']), 
    projectController.removeProjectMember
);

router.put('/:id/team/:memberId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']), 
    projectController.updateMemberRole
);

// Project Timeline
router.get('/:id/timeline', 
    authenticate, 
    projectController.getProjectTimeline
);

router.post('/:id/timeline', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.addTimelineEvent
);

router.put('/:id/timeline/:eventId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.updateTimelineEvent
);

router.delete('/:id/timeline/:eventId', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager', 'teamlead']), 
    projectController.deleteTimelineEvent
);

module.exports = router;