const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../utils/errors');

// Create uploads directory if it doesn't exist
const createUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = '';
    
    switch (file.fieldname) {
      case 'photo':
        uploadPath = path.join(__dirname, '../uploads/photos');
        break;
      case 'resume':
        uploadPath = path.join(__dirname, '../uploads/resumes');
        break;
      case 'document':
        uploadPath = path.join(__dirname, '../uploads/documents');
        break;
      default:
        uploadPath = path.join(__dirname, '../uploads/others');
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    photo: ['image/jpeg', 'image/png', 'image/jpg'],
    resume: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  };

  const allowed = allowedTypes[file.fieldname] || ['application/pdf', 'image/jpeg', 'image/png'];
  
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError('Invalid file type', 400), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Max 5 files at once
  }
});

module.exports = upload; 