// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { loginAuth, adminAuth, superadminAuth } = require('../../middleware/auth');
const userController = require('../../controllers/admin/userController');

// Create uploads directory if it doesn't exist
const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join('uploads', 'users');
        createUploadDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'photo') {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an image file (jpg, jpeg, png)'), false);
        }
    } else if (file.fieldname === 'resume') {
        if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
            return cb(new Error('Please upload a valid document (pdf, doc, docx)'), false);
        }
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});



// Configure multiple file uploads
const uploadFields = upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 }
]);

// Public route
router.post('/login', userController.login);

// Protected routes
router.get('/', loginAuth, userController.getAllUsers);
router.get('/:id', loginAuth, userController.getUserById);

// Admin only routes with file upload
router.post('/', loginAuth, adminAuth, uploadFields, userController.addUser);
router.put('/:id', loginAuth, adminAuth, uploadFields, userController.updateUserById);
router.delete('/:id', loginAuth, superadminAuth, userController.deleteUserById);
router.put('/:id/status', loginAuth, adminAuth, userController.updateStatusUserById);

module.exports = router;


