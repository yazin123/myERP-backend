const express = require('express');
const router = express.Router();
const { authorize } = require('../../middleware/auth');

// Import route modules
const userRoutes = require('./userRoutes');
const projectRoutes = require('./projectRoutes');
const taskRoutes = require('./taskRoutes');
const rbacRoutes = require('./rbacRoutes');
const enumRoutes = require('./enumRoutes');
const departmentRoutes = require('./departmentRoutes');
const designationRoutes = require('./designationRoutes');
const performanceRoutes = require('./performanceRoutes');
const monitoringRoutes = require('./monitoringRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const leadRoutes = require('./leadRoutes');

// Mount routes with admin authorization
router.use('/users', authorize(['admin', 'superadmin']), userRoutes);
router.use('/projects', authorize(['admin', 'superadmin']), projectRoutes);
router.use('/tasks', authorize(['admin', 'superadmin']), taskRoutes);
router.use('/rbac', authorize(['superadmin']), rbacRoutes);
router.use('/system', authorize(['admin', 'superadmin']), enumRoutes);
router.use('/departments', authorize(['admin', 'superadmin']), departmentRoutes);
router.use('/designations', authorize(['admin', 'superadmin']), designationRoutes);
router.use('/performance', authorize(['admin', 'superadmin']), performanceRoutes);
router.use('/monitoring', authorize(['admin', 'superadmin']), monitoringRoutes);
router.use('/dashboard', authorize(['admin', 'superadmin']), dashboardRoutes);
router.use('/leads', authorize(['admin', 'superadmin']), leadRoutes);

module.exports = router; 