const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');

// Import route modules from existing structure
const authRoutes = require('../auth/authRoutes');
const adminRoutes = require('../admin');
const userRoutes = require('../admin/userRoutes');
const projectRoutes = require('../admin/projectRoutes');
const taskRoutes = require('../admin/taskRoutes');
const performanceRoutes = require('../admin/performanceRoutes');
const departmentRoutes = require('../admin/departmentRoutes');
const designationRoutes = require('../admin/designationRoutes');
const rbacRoutes = require('../admin/rbacRoutes');
const monitoringRoutes = require('../admin/monitoringRoutes');
const enumRoutes = require('../admin/enumRoutes');

// Mount routes with v1 prefix
router.use('/auth', authRoutes);
router.use('/admin', authenticate, adminRoutes);
router.use('/users', authenticate, userRoutes);
router.use('/projects', authenticate, projectRoutes);
router.use('/tasks', authenticate, taskRoutes);
router.use('/performance', authenticate, performanceRoutes);
router.use('/departments', authenticate, departmentRoutes);
router.use('/designations', authenticate, designationRoutes);
router.use('/rbac', authenticate, rbacRoutes);
router.use('/monitoring', authenticate, monitoringRoutes);
router.use('/enums', authenticate, enumRoutes);

module.exports = router; 