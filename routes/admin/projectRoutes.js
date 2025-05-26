const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { loginAuth, checkAccessProject, apiLimiter, authenticate, authorize } = require('../../middleware/auth');
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

const upload = multer({
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
router.get('/', authenticate, projectController.getAllProjects);
router.get('/:id', authenticate, projectController.getProjectById);
router.get('/assigned', loginAuth, projectController.getAssignedProjects);

// Create and Update routes with file handling
router.post('/', 
    authenticate, 
    authorize(['admin', 'superadmin', 'manager']), 
    upload.array('files'), 
    handleMulterError, 
    projectController.createProject
);

router.put('/:id', 
    authenticate, 
    upload.array('files'), 
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
    express.json(),
    projectController.updateProjectStatus
);

// Update project pipeline
router.patch('/:id/pipeline', 
    authenticate, 
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

module.exports = router;