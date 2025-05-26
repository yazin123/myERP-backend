// routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize, adminAuth } = require('../../middleware/auth');
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
router.get('/', authenticate, taskController.getTaskAll);
router.get('/:id', authenticate, taskController.getTaskById);
router.get('/user/:id', authenticate, taskController.getTaskAllByUserId);
router.get('/deadline/:date', authenticate, taskController.getTaskByDeadline);

// Task management routes
router.post('/', 
  authenticate, 
  authorize(['admin', 'teamlead', 'manager']), 
  upload.array('files', 5), 
  taskController.addTask
);

router.put('/:id', 
  authenticate, 
  authorize(['admin', 'teamlead', 'manager']), 
  upload.array('files', 5), 
  taskController.updateTask
);

router.delete('/:id', 
  authenticate, 
  authorize(['admin', 'superadmin']), 
  taskController.deleteTask
);

// Task status routes
router.put('/:id/status', 
  authenticate, 
  taskController.updateTaskStatus
);

router.put('/:id/approve', 
  authenticate, 
  authorize(['admin', 'teamlead', 'manager']), 
  taskController.updateTaskisCompletedApprove
);

// Analytics routes
router.get('/analytics/self', 
  authenticate, 
  taskController.getAnalyticsByUserIdSelf
);

router.get('/analytics/assigned', 
  authenticate, 
  taskController.getAnalyticsByUserIdAssigned
);

module.exports = router;

