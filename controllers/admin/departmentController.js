const Department = require('../../models/Department');
const logger = require('../../utils/logger');
const { validateObjectId } = require('../utils/validation');
const { AppError } = require('../../utils/error');

const departmentController = {
    // Get all departments
    getAllDepartments: async (req, res) => {
        try {
            const departments = await Department.find()
                .sort('name')
                .select('name code description createdAt');

            res.json(departments);
        } catch (error) {
            logger.error('Get departments error:', error);
            res.status(500).json({ message: 'Failed to fetch departments' });
        }
    },

    // Create new department
    createDepartment: async (req, res) => {
        try {
            const { name, code, description } = req.body;

            // Check if department with same code exists
            const existingDepartment = await Department.findOne({ code });
            if (existingDepartment) {
                return res.status(400).json({ message: 'Department code already exists' });
            }

            const department = new Department({
                name,
                code,
                description,
                createdBy: req.user._id
            });

            await department.save();
            res.status(201).json(department);
        } catch (error) {
            logger.error('Create department error:', error);
            res.status(500).json({ message: 'Failed to create department' });
        }
    },

    // Update department
    updateDepartment: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;

            const department = await Department.findById(id);
            if (!department) {
                return res.status(404).json({ message: 'Department not found' });
            }

            department.name = name;
            department.description = description;
            department.lastModifiedBy = req.user._id;
            department.lastModifiedAt = Date.now();

            await department.save();
            res.json(department);
        } catch (error) {
            logger.error('Update department error:', error);
            res.status(500).json({ message: 'Failed to update department' });
        }
    },

    // Delete department
    deleteDepartment: async (req, res) => {
        try {
            const { id } = req.params;

            const department = await Department.findById(id);
            if (!department) {
                return res.status(404).json({ message: 'Department not found' });
            }

            // Check if department has any associated designations
            const hasDesignations = await Designation.exists({ department: id });
            if (hasDesignations) {
                return res.status(400).json({ 
                    message: 'Cannot delete department with existing designations' 
                });
            }

            await department.remove();
            res.json({ message: 'Department deleted successfully' });
        } catch (error) {
            logger.error('Delete department error:', error);
            res.status(500).json({ message: 'Failed to delete department' });
        }
    }
};

module.exports = departmentController;

// Get department by ID
exports.getDepartmentById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return next(new AppError('Invalid department ID', 400));
        }

        const department = await Department.findOne({ _id: id, isActive: true });

        if (!department) {
            return next(new AppError('Department not found', 404));
        }

        res.status(200).json({
            success: true,
            data: department
        });
    } catch (error) {
        next(error);
    }
}; 