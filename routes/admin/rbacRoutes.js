const express = require('express');
const router = express.Router();
const rbacController = require('../../controllers/admin/rbacController');
const systemEnumController = require('../../controllers/admin/systemEnumController');
const { authenticate, authorize } = require('../../middleware/auth');

// Role routes
router.get('/roles', 
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.getAllRoles
);

router.post('/roles',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.createRole
);

router.put('/roles/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.updateRole
);

router.delete('/roles/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.deleteRole
);

// Permission routes
router.get('/permissions',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.getAllPermissions
);

router.post('/permissions',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.createPermission
);

// Role-Permission routes
router.get('/roles/:roleId/permissions',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.getRolePermissions
);

router.put('/roles/:roleId/permissions',
    authenticate,
    authorize(['admin', 'superadmin']),
    rbacController.updateRolePermissions
);

// System Enum routes
router.get('/enums',
    authenticate,
    authorize(['admin', 'superadmin']),
    systemEnumController.getAllSystemEnums
);

router.get('/enums/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    systemEnumController.getSystemEnumById
);

router.post('/enums',
    authenticate,
    authorize(['admin', 'superadmin']),
    systemEnumController.createSystemEnum
);

router.put('/enums/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    systemEnumController.updateSystemEnum
);

router.delete('/enums/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    systemEnumController.deleteSystemEnum
);

module.exports = router; 