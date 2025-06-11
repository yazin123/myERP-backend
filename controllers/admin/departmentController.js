const Department = require('../../models/Department');
const Designation = require('../../models/Designation');
const logger = require('../../utils/logger');
const { validateObjectId } = require('../../utils/validation');
const { AppError } = require('../../middleware/errorHandler');
const User = require('../../models/User');

const departmentController = {
    // Get all departments
    getAllDepartments: async (req, res, next) => {
        try {
            const departments = await Department.find()
                .populate('head', 'name email')
                .sort('name')
                .select('name code description createdAt');

            res.status(200).json({
                success: true,
                data: {
                    departments: departments
                }
            });
        } catch (error) {
            logger.error('Get departments error:', error);
            next(new AppError(500, 'Failed to fetch departments'));
        }
    },

    // Create new department
    createDepartment: async (req, res, next) => {
        try {
            const { name, code, description, head } = req.body;

            // Check if department with same code exists
            const existingDepartment = await Department.findOne({ code });
            if (existingDepartment) {
                return next(new AppError(400, 'Department code already exists'));
            }

            const department = new Department({
                name,
                code,
                description,
                head: head || null, // Make head optional
                createdBy: req.user._id
            });

            await department.save();
            
            res.status(201).json({
                success: true,
                data: {
                    department: department
                }
            });
        } catch (error) {
            logger.error('Create department error:', error);
            next(new AppError(500, 'Failed to create department'));
        }
    },

    // Update department
    updateDepartment: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, description } = req.body;

            if (!validateObjectId(id)) {
                return next(new AppError(400, 'Invalid department ID'));
            }

            const department = await Department.findById(id);
            if (!department) {
                return next(new AppError(404, 'Department not found'));
            }

            department.name = name;
            department.description = description;
            department.lastModifiedBy = req.user._id;
            department.lastModifiedAt = Date.now();

            await department.save();
            
            res.status(200).json({
                success: true,
                data: department
            });
        } catch (error) {
            logger.error('Update department error:', error);
            next(new AppError(500, 'Failed to update department'));
        }
    },

    // Delete department
    deleteDepartment: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!validateObjectId(id)) {
                return next(new AppError(400, 'Invalid department ID'));
            }

            const department = await Department.findById(id);
            if (!department) {
                return next(new AppError(404, 'Department not found'));
            }

            // Check if department has any associated designations
            const hasDesignations = await Designation.exists({ department: id });
            if (hasDesignations) {
                return next(new AppError(400, 'Cannot delete department with existing designations'));
            }

            await department.deleteOne();
            
            res.status(200).json({
                success: true,
                message: 'Department deleted successfully'
            });
        } catch (error) {
            logger.error('Delete department error:', error);
            next(new AppError(500, 'Failed to delete department'));
        }
    },

    // Get department designations
    getDepartmentDesignations: async (req, res, next) => {
        try {
            const { departmentId } = req.params;

            if (!validateObjectId(departmentId)) {
                return next(new AppError(400, 'Invalid department ID'));
            }

            const designations = await Designation.find({ department: departmentId })
                .sort('name')
                .select('name description level createdAt');

            res.status(200).json({
                success: true,
                data: designations
            });
        } catch (error) {
            logger.error('Get department designations error:', error);
            next(new AppError(500, 'Failed to fetch department designations'));
        }
    },

    // Get department by ID
    getDepartmentById: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!validateObjectId(id)) {
                return next(new AppError(400, 'Invalid department ID'));
            }

            const department = await Department.findOne({ _id: id, isActive: true });

            if (!department) {
                return next(new AppError(404, 'Department not found'));
            }

            res.status(200).json({
                success: true,
                data: {
                    department: department
                }
            });
        } catch (error) {
            logger.error('Get department by ID error:', error);
            next(new AppError(500, 'Failed to fetch department'));
        }
    },

    // Add new method to update department head
    updateDepartmentHead: async (req, res, next) => {
        try {
            const { departmentId } = req.params;
            const { head } = req.body;

            if (!validateObjectId(departmentId)) {
                return next(new AppError(400, 'Invalid department ID'));
            }

            if (!validateObjectId(head)) {
                return next(new AppError(400, 'Invalid user ID for department head'));
            }

            const department = await Department.findById(departmentId);
            if (!department) {
                return next(new AppError(404, 'Department not found'));
            }

            // Check if the user exists and is valid
            const user = await User.findById(head);
            if (!user) {
                return next(new AppError(404, 'User not found'));
            }

            await department.updateHead(head);
            
            res.status(200).json({
                success: true,
                data: {
                    department: department
                }
            });
        } catch (error) {
            logger.error('Update department head error:', error);
            next(new AppError(500, 'Failed to update department head'));
        }
    }
};

module.exports = departmentController; 