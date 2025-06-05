const express = require('express');
const router = express.Router();
const { auth, requireRoles } = require('../../middleware/auth');
const departmentController = require('../../controllers/common/departmentController');

// Get all departments
router.get('/', auth, departmentController.getDepartments);

// Get department by ID
router.get('/:departmentId', auth, departmentController.getDepartmentById);

// Create new department
router.post('/', auth, requireRoles('admin'), departmentController.createDepartment);

// Update department
router.put('/:departmentId', auth, requireRoles('admin'), departmentController.updateDepartment);

// Delete department
router.delete('/:departmentId', auth, requireRoles('admin'), departmentController.deleteDepartment);

// Get department employees
router.get('/:departmentId/employees', auth, departmentController.getDepartmentEmployees);

// Get department projects
router.get('/:departmentId/projects', auth, departmentController.getDepartmentProjects);

// Get department statistics
router.get('/:departmentId/statistics', auth, departmentController.getDepartmentStatistics);

// Update department budget
router.put('/:departmentId/budget', auth, requireRoles('admin'), departmentController.updateDepartmentBudget);

module.exports = router; 