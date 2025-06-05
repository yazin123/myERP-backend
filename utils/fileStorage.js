const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ApiError } = require('./errors');

// Base upload directory
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directories exist
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Initialize upload directories
ensureDirectoryExists(UPLOAD_DIR);
ensureDirectoryExists(path.join(UPLOAD_DIR, 'projects'));
ensureDirectoryExists(path.join(UPLOAD_DIR, 'tasks'));
ensureDirectoryExists(path.join(UPLOAD_DIR, 'users'));

/**
 * Upload a file
 * @param {Object} file - The file object from multer
 * @param {String} directory - The subdirectory to store the file in
 * @returns {Promise<String>} The file URL
 */
exports.uploadFile = async (file, directory = '') => {
  try {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const uploadPath = path.join(UPLOAD_DIR, directory, filename);

    // Create write stream
    const writeStream = fs.createWriteStream(uploadPath);

    // Write file
    await new Promise((resolve, reject) => {
      writeStream.write(file.buffer, (error) => {
        if (error) reject(error);
        resolve();
      });
    });

    // Return relative path
    return path.join('uploads', directory, filename);
  } catch (error) {
    throw new ApiError(500, 'Error uploading file');
  }
};

/**
 * Delete a file
 * @param {String} fileUrl - The file URL to delete
 * @returns {Promise<void>}
 */
exports.deleteFile = async (fileUrl) => {
  try {
    const filePath = path.join(__dirname, '..', fileUrl);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    throw new ApiError(500, 'Error deleting file');
  }
};

/**
 * Get file stats
 * @param {String} fileUrl - The file URL
 * @returns {Promise<Object>} File stats
 */
exports.getFileStats = async (fileUrl) => {
  try {
    const filePath = path.join(__dirname, '..', fileUrl);
    const stats = await fs.promises.stat(filePath);
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime
    };
  } catch (error) {
    throw new ApiError(500, 'Error getting file stats');
  }
};

/**
 * Check if file exists
 * @param {String} fileUrl - The file URL to check
 * @returns {Promise<Boolean>}
 */
exports.fileExists = async (fileUrl) => {
  try {
    const filePath = path.join(__dirname, '..', fileUrl);
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}; 