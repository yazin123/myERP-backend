const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { loginAuth, checkAccessProject, apiLimiter } = require('../../middleware/auth');
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
        // Add timestamp to prevent filename collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
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
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files per update
    },
});

// Error handling middleware for multer
const handleMulterErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size limit exceeded (10MB max)' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files (5 max)' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

// Routes
router.get('', loginAuth, apiLimiter, projectController.getAllProjects);
router.get('/:id', loginAuth, projectController.getProjectById);
router.get('/assigned', loginAuth, projectController.getAssignedProjects);

// Create and Update routes with file handling
router.post('', 
    loginAuth, 
    upload.array('files', 5), 
    handleMulterErrors, 
    projectController.createProject
);

router.put('/update', 
    loginAuth, 
    checkAccessProject, 
    upload.array('files', 5), 
    handleMulterErrors, 
    projectController.updateProject
);

router.delete('/:id', loginAuth, checkAccessProject, projectController.deleteProject);

module.exports = router;