const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../../middleware/auth');
const employeeController = require('../../controllers/admin/employeeController');

// Multer configuration for resume uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/resumes');
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
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size limit exceeded (5MB max)'
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

// Base route: /api/admin/employees

// Create employee - Only admin and HR can create employees
router.post(
    '/',
    authenticate,
    authorize(['admin', 'hr']),
    upload.single('resume'),
    handleMulterError,
    employeeController.createEmployee
);

// Get all employees with filters
router.get(
    '/',
    authenticate,
    authorize(['admin', 'hr', 'teamlead', 'projectmanager']),
    employeeController.getEmployees
);

// Get single employee
router.get(
    '/:id',
    authenticate,
    employeeController.getEmployee
);

// Update employee - Only admin and HR can update employees
router.put(
    '/:id',
    authenticate,
    authorize(['admin', 'hr']),
    upload.single('resume'),
    handleMulterError,
    employeeController.updateEmployee
);

// Delete employee - Only admin can delete employees
router.delete(
    '/:id',
    authenticate,
    authorize(['admin']),
    employeeController.deleteEmployee
);

// Record attendance with WiFi validation
router.post(
    '/:id/attendance',
    authenticate,
    employeeController.recordAttendance
);

// Submit daily report
router.post(
    '/:id/daily-report',
    authenticate,
    employeeController.submitDailyReport
);

// Get employee performance
router.get(
    '/:id/performance',
    authenticate,
    authorize(['admin', 'hr', 'teamlead', 'projectmanager']),
    employeeController.getPerformance
);

module.exports = router; 