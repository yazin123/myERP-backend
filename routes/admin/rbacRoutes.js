const express = require('express');
const router = express.Router();
const rbacController = require('../../controllers/admin/rbacController');
const systemEnumController = require('../../controllers/admin/systemEnumController');
const { authenticate, authorize } = require('../../middleware/auth');

// Role routes - Require high level access (80+) for role management
router.get('/roles', 
    authenticate,
    authorize(80),
    rbacController.getAllRoles
);

router.post('/roles',
    authenticate,
    authorize(80),
    rbacController.createRole
);

router.put('/roles/:id',
    authenticate,
    authorize(80),
    rbacController.updateRole
);

router.delete('/roles/:id',
    authenticate,
    authorize(80),
    rbacController.deleteRole
);

// Permission routes - Require very high level access (90+) for permission management
router.get('/permissions',
    authenticate,
    authorize(90),
    rbacController.getAllPermissions
);

router.post('/permissions',
    authenticate,
    authorize(90),
    rbacController.createPermission
);

// Role-Permission routes - Require high level access (80+)
router.get('/roles/:roleId/permissions',
    authenticate,
    authorize(80),
    rbacController.getRolePermissions
);

router.put('/roles/:roleId/permissions',
    authenticate,
    authorize(80),
    rbacController.updateRolePermissions
);

// System Enum routes - Require admin level access (70+)
router.get('/enums',
    authenticate,
    authorize(70),
    systemEnumController.getAllSystemEnums
);

router.get('/enums/:id',
    authenticate,
    authorize(70),
    systemEnumController.getSystemEnumById
);

router.post('/enums',
    authenticate,
    authorize(70),
    systemEnumController.createSystemEnum
);

router.put('/enums/:id',
    authenticate,
    authorize(70),
    systemEnumController.updateSystemEnum
);

router.delete('/enums/:id',
    authenticate,
    authorize(70),
    systemEnumController.deleteSystemEnum
);

module.exports = router; 