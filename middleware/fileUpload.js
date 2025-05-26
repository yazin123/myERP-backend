const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('./errorHandler');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        crypto.randomBytes(16, (err, raw) => {
            if (err) return cb(err);

            const filename = raw.toString('hex') + path.extname(file.originalname);
            cb(null, filename);
        });
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError(400, 'Invalid file type. Only images, PDFs, Office documents, and text files are allowed.'));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files per request
    }
});

// Middleware for handling file upload errors
const handleFileUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(400, 'File too large. Maximum size is 10MB.'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return next(new AppError(400, 'Too many files. Maximum is 5 files per request.'));
        }
        return next(new AppError(400, 'File upload error: ' + err.message));
    }
    next(err);
};

// Middleware for single file upload
const uploadSingle = (fieldName) => {
    return [
        upload.single(fieldName),
        handleFileUploadError
    ];
};

// Middleware for multiple files upload
const uploadMultiple = (fieldName, maxCount = 5) => {
    return [
        upload.array(fieldName, maxCount),
        handleFileUploadError
    ];
};

// Middleware for multiple fields upload
const uploadFields = (fields) => {
    return [
        upload.fields(fields),
        handleFileUploadError
    ];
};

// Clean up uploaded files in case of error
const cleanupOnError = async (req, res, next) => {
    const fs = require('fs').promises;
    
    if (!res.headersSent && req.file) {
        try {
            await fs.unlink(req.file.path);
        } catch (error) {
            console.error('Error cleaning up file:', error);
        }
    }
    
    if (!res.headersSent && req.files) {
        const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
        for (const file of files) {
            try {
                await fs.unlink(file.path);
            } catch (error) {
                console.error('Error cleaning up file:', error);
            }
        }
    }
    
    next();
};

module.exports = {
    uploadSingle,
    uploadMultiple,
    uploadFields,
    cleanupOnError
}; 