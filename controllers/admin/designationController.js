const Designation = require('../../models/Designation');
const Department = require('../../models/Department');
const logger = require('../../utils/logger');
const { validateObjectId } = require('../../utils/validation');
const { AppError } = require('../../utils/error');
const User = require('../../models/User');

const designationController = {
    // Get all designations
    getAllDesignations: async (req, res, next) => {
        try {
            const designations = await Designation.find()
                .populate('department', 'name code')
                .sort('name')
                .select('name description level department createdAt');

            res.status(200).json({
                success: true,
                data: designations
            });
        } catch (error) {
            logger.error('Get designations error:', error);
            next(new AppError('Failed to fetch designations', 500));
        }
    },

    // Get designation by ID
    getDesignationById: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!validateObjectId(id)) {
                return next(new AppError('Invalid designation ID', 400));
            }

            const designation = await Designation.findById(id)
                .populate('department', 'name code')
                .select('name description level department createdAt');

            if (!designation) {
                return next(new AppError('Designation not found', 404));
            }

            res.status(200).json({
                success: true,
                data: designation
            });
        } catch (error) {
            logger.error('Get designation by ID error:', error);
            next(new AppError('Failed to fetch designation', 500));
        }
    },

    // Get designations by department
    getDesignationsByDepartment: async (req, res, next) => {
        try {
            const { departmentId } = req.params;

            if (!validateObjectId(departmentId)) {
                return next(new AppError('Invalid department ID', 400));
            }

            const designations = await Designation.find({ department: departmentId })
                .populate('department', 'name code')
                .sort('level name')
                .select('name description level createdAt');

            res.status(200).json({
                success: true,
                data: designations
            });
        } catch (error) {
            logger.error('Get department designations error:', error);
            next(new AppError('Failed to fetch department designations', 500));
        }
    },

    // Create new designation
    createDesignation: async (req, res, next) => {
        try {
            const { name, description, department, level } = req.body;

            if (!validateObjectId(department)) {
                return next(new AppError('Invalid department ID', 400));
            }

            // Check if department exists
            const departmentExists = await Department.findById(department);
            if (!departmentExists) {
                return next(new AppError('Department not found', 400));
            }

            // Check if designation with same name exists in department
            const existingDesignation = await Designation.findOne({ 
                name, 
                department 
            });
            if (existingDesignation) {
                return next(new AppError('Designation already exists in this department', 400));
            }

            const designation = new Designation({
                name,
                description,
                department,
                level,
                createdBy: req.user._id
            });

            await designation.save();
            
            res.status(201).json({
                success: true,
                data: designation
            });
        } catch (error) {
            logger.error('Create designation error:', error);
            next(new AppError('Failed to create designation', 500));
        }
    },

    // Update designation
    updateDesignation: async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, description, level } = req.body;

            if (!validateObjectId(id)) {
                return next(new AppError('Invalid designation ID', 400));
            }

            const designation = await Designation.findById(id);
            if (!designation) {
                return next(new AppError('Designation not found', 404));
            }

            designation.name = name;
            designation.description = description;
            designation.level = level;
            designation.lastModifiedBy = req.user._id;
            designation.lastModifiedAt = Date.now();

            await designation.save();
            
            res.status(200).json({
                success: true,
                data: designation
            });
        } catch (error) {
            logger.error('Update designation error:', error);
            next(new AppError('Failed to update designation', 500));
        }
    },

    // Delete designation
    deleteDesignation: async (req, res, next) => {
        try {
            const { id } = req.params;

            if (!validateObjectId(id)) {
                return next(new AppError('Invalid designation ID', 400));
            }

            const designation = await Designation.findById(id);
            if (!designation) {
                return next(new AppError('Designation not found', 404));
            }

            // Check if designation has any associated employees
            const hasEmployees = await User.exists({ designation: id });
            if (hasEmployees) {
                return next(new AppError('Cannot delete designation with existing employees', 400));
            }

            await designation.deleteOne();
            
            res.status(200).json({
                success: true,
                message: 'Designation deleted successfully'
            });
        } catch (error) {
            logger.error('Delete designation error:', error);
            next(new AppError('Failed to delete designation', 500));
        }
    }
};

module.exports = designationController; 