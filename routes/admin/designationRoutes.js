const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { checkPermission } = require('../../middleware/permission');
const designationController = require('../../controllers/admin/designationController');

// Get all designations
router.get('/', [
    authenticate,
    checkPermission('view_designations'),
    designationController.getAllDesignations
]);

// Create new designation
router.post('/', [
    authenticate,
    checkPermission('manage_designations'),
    designationController.createDesignation
]);

// Get designation by ID
router.get('/:id', [
    authenticate,
    checkPermission('view_designations'),
    designationController.getDesignationById
]);

// Update designation
router.put('/:id', [
    authenticate,
    checkPermission('manage_designations'),
    designationController.updateDesignation
]);

// Delete designation
router.delete('/:id', [
    authenticate,
    checkPermission('manage_designations'),
    designationController.deleteDesignation
]);

module.exports = router; 