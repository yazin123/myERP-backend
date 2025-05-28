// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize, adminAuth } = require('../../middleware/auth');
const userController = require('../../controllers/admin/userController');

// Create uploads directory if it doesn't exist
const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = '';
        if (file.fieldname === 'photo') {
            uploadPath = path.join(__dirname, '../../uploads/photos');
        } else if (file.fieldname === 'resume') {
            uploadPath = path.join(__dirname, '../../uploads/resumes');
        }
        createUploadDir(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'photo') {
            if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
                return cb(new Error('Only image files are allowed!'), false);
            }
        } else if (file.fieldname === 'resume') {
            if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
                return cb(new Error('Only PDF and Word documents are allowed!'), false);
            }
        }
        cb(null, true);
    }
});

const uploadFields = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
]);

// Handle multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            success: false,
            message: err.message 
        });
    } else if (err) {
        return res.status(400).json({ 
            success: false,
            message: err.message 
        });
    }
    next();
};

// Public routes
router.post('/login', userController.login);

// Protected routes - require admin access
router.get('/current', authenticate, userController.getCurrentUser);
router.get('/', authenticate, authorize(['admin', 'superadmin']), userController.getAllUsers);
router.get('/managers', adminAuth, userController.getManagers);
router.get('/:id', authenticate, authorize(['admin', 'superadmin']), userController.getUserById);
router.put('/update/:id', 
    authenticate, 
    authorize(['admin', 'superadmin']), 
    uploadFields, 
    handleMulterError, 
    userController.updateUser
);

// Admin and Superadmin routes with file upload
router.post('/', 
    authenticate, 
    authorize(['admin', 'superadmin']), 
    uploadFields, 
    handleMulterError, 
    userController.addUser
);

// Superadmin only routes
router.delete('/:id', 
    authenticate, 
    authorize(['admin', 'superadmin']), 
    userController.deleteUser
);

// User's own password change
router.put('/:id/change-password', authenticate, async (req, res, next) => {
    // Allow users to change their own password, or admins/superadmins to change others
    if (req.user._id.toString() === req.params.id || ['admin', 'superadmin'].includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized to change this user\'s password' });
    }
}, userController.changePassword);

module.exports = router;


