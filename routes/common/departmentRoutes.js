const express = require('express');
const router = express.Router();
const { authenticate, requireRoles } = require('../../middleware/auth');
const departmentController = require('../../controllers/common/departmentController');

// Get all departments
router.get('/', authenticate, departmentController.getDepartments);

// Get department by ID
router.get('/:departmentId', authenticate, departmentController.getDepartmentById);

// Create new department
router.post('/', authenticate, requireRoles('admin'), departmentController.createDepartment);

// Update department
router.put('/:departmentId', authenticate, requireRoles('admin'), departmentController.updateDepartment);

// Delete department
router.delete('/:departmentId', authenticate, requireRoles('admin'), departmentController.deleteDepartment);

// Get department employees
router.get('/:departmentId/employees', authenticate, departmentController.getDepartmentEmployees);

// Get department projects
router.get('/:departmentId/projects', authenticate, departmentController.getDepartmentProjects);

// Get department statistics
router.get('/:departmentId/statistics', authenticate, departmentController.getDepartmentStatistics);

// Update department budget
router.put('/:departmentId/budget', authenticate, requireRoles('admin'), departmentController.updateDepartmentBudget);

module.exports = router; 