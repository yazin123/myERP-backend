const express = require('express');
const router = express.Router();
const enumController = require('../../controllers/admin/enumController');
const { authenticate, authorize } = require('../../middleware/auth');

// Enum routes
router.get('/enums',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.getAllEnums
);

router.get('/enums/module/:module',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.getModuleEnums
);

router.post('/enums',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.createEnum
);

router.put('/enums/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.updateEnum
);

router.delete('/enums/:id',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.deleteEnum
);

// Enum value routes
router.post('/enums/:id/values',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.addEnumValue
);

router.put('/enums/:id/values/:valueId',
    authenticate,
    authorize(['admin', 'superadmin']),
    enumController.updateEnumValue
);

module.exports = router; 