const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { checkPermission } = require('../../middleware/permission');

// Import controllers
const departmentController = require('../../controllers/departmentController');
const designationController = require('../../controllers/designationController');
const systemEnumController = require('../../controllers/systemEnumController');
const rbacController = require('../../controllers/admin/rbacController');
const userController = require('../../controllers/admin/userController');
const dashboardController = require('../../controllers/admin/dashboardController');
const performanceController = require('../../controllers/admin/performanceController');

// Department routes
router.get('/departments',
    authenticate,
    departmentController.getAllDepartments
);

router.post('/departments',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.createDepartment
);

router.put('/departments/:id',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.updateDepartment
);

router.delete('/departments/:id',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.deleteDepartment
);

// Designation routes
router.get('/designations',
    authenticate,
    designationController.getAllDesignations
);

router.get('/departments/:departmentId/designations',
    authenticate,
    designationController.getDesignationsByDepartment
);

router.post('/designations',
    authenticate,
    checkPermission('manage_departments'),
    designationController.createDesignation
);

router.put('/designations/:id',
    authenticate,
    checkPermission('manage_departments'),
    designationController.updateDesignation
);

router.delete('/designations/:id',
    authenticate,
    checkPermission('manage_departments'),
    designationController.deleteDesignation
);

// RBAC routes
router.get('/roles',
    authenticate,
    checkPermission('manage_roles'),
    rbacController.getAllRoles
);

router.post('/roles',
    authenticate,
    checkPermission('manage_roles'),
    rbacController.createRole
);

router.get('/permissions',
    authenticate,
    checkPermission('manage_roles'),
    rbacController.getAllPermissions
);

router.post('/permissions',
    authenticate,
    checkPermission('manage_roles'),
    rbacController.createPermission
);

// System enums routes
router.get('/enums',
    authenticate,
    checkPermission('manage_system_enums'),
    systemEnumController.getAllSystemEnums
);

router.get('/enums/:id',
    authenticate,
    checkPermission('manage_system_enums'),
    systemEnumController.getSystemEnumById
);

router.post('/enums',
    authenticate,
    checkPermission('manage_system_enums'),
    systemEnumController.createSystemEnum
);

router.put('/enums/:id',
    authenticate,
    checkPermission('manage_system_enums'),
    systemEnumController.updateSystemEnum
);

router.delete('/enums/:id',
    authenticate,
    checkPermission('manage_system_enums'),
    systemEnumController.deleteSystemEnum
);

// Dashboard routes
router.get('/dashboard',
    authenticate,
    checkPermission('view_dashboard'),
    dashboardController.getDashboardStats
);

// Performance routes
router.get('/performance',
    authenticate,
    checkPermission('view_performance'),
    performanceController.getAllPerformance
);

router.get('/performance/:id',
    authenticate,
    checkPermission('view_performance'),
    performanceController.getPerformanceById
);

module.exports = router; 