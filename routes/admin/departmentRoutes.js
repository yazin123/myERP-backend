const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { checkPermission } = require('../../middleware/permission');
const departmentController = require('../../controllers/admin/departmentController');

// Department routes
router.get('/',
    authenticate,
    checkPermission('view_departments'),
    departmentController.getAllDepartments
);

router.post('/',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.createDepartment
);

router.get('/:id',
    authenticate,
    checkPermission('view_departments'),
    departmentController.getDepartmentById
);

router.put('/:id',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.updateDepartment
);

router.delete('/:id',
    authenticate,
    checkPermission('manage_departments'),
    departmentController.deleteDepartment
);

router.get('/:departmentId/designations',
    authenticate,
    checkPermission('view_departments'),
    departmentController.getDepartmentDesignations
);

module.exports = router; 