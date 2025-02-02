// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { loginAuth, teamLeadAuth, adminAuth } = require('../../middleware/auth');
const taskController = require('../../controllers/admin/taskController');

// Create uploads directory for task files
const createUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer storage for task files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join('uploads', 'tasks');
    createUploadDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'task-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Task routes
router.get('/', loginAuth, taskController.getTaskAll);
router.get('/:id', loginAuth, taskController.getTaskById);
router.get('/user/:id', loginAuth, taskController.getTaskAllByUserId);
router.get('/deadline/:date', loginAuth, taskController.getTaskByDeadline);
router.post('/', loginAuth, upload.array('files', 5), taskController.addTask);
router.put('/:id', loginAuth, upload.array('files', 5), taskController.updateTask);
router.delete('/:id', loginAuth, adminAuth, taskController.deleteTask);
router.put('/:id/status', loginAuth, taskController.updateTaskStatus);
router.put('/:id/approve', loginAuth, teamLeadAuth, taskController.updateTaskisCompletedApprove);
router.get('/analytics/self', loginAuth, taskController.getAnalyticsByUserIdSelf);
router.get('/analytics/assigned', loginAuth, taskController.getAnalyticsByUserIdAssigned);

module.exports = router;

