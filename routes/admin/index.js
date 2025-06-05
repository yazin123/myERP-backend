const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const taskRoutes = require('./taskRoutes');
const rbacRoutes = require('./rbacRoutes');
const enumRoutes = require('./enumRoutes');

// Mount routes
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/rbac', rbacRoutes);
router.use('/system', enumRoutes);

module.exports = router; 