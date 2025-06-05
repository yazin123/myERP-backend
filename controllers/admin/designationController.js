const Designation = require('../../models/Designation');
const Department = require('../../models/Department');
const logger = require('../../utils/logger');
const { validateObjectId } = require('../utils/validation');
const { AppError } = require('../../utils/error');
const User = require('../../models/User');

const designationController = {
    // Get all designations
    getAllDesignations: async (req, res) => {
        try {
            const designations = await Designation.find()
                .populate('department', 'name code')
                .sort('name')
                .select('name description level department createdAt');

            res.json(designations);
        } catch (error) {
            logger.error('Get designations error:', error);
            res.status(500).json({ message: 'Failed to fetch designations' });
        }
    },

    // Get designations by department
    getDesignationsByDepartment: async (req, res) => {
        try {
            const { departmentId } = req.params;

            const designations = await Designation.find({ department: departmentId })
                .populate('department', 'name code')
                .sort('level name')
                .select('name description level createdAt');

            res.json(designations);
        } catch (error) {
            logger.error('Get department designations error:', error);
            res.status(500).json({ message: 'Failed to fetch department designations' });
        }
    },

    // Create new designation
    createDesignation: async (req, res) => {
        try {
            const { name, description, department, level } = req.body;

            // Check if department exists
            const departmentExists = await Department.findById(department);
            if (!departmentExists) {
                return res.status(400).json({ message: 'Department not found' });
            }

            // Check if designation with same name exists in department
            const existingDesignation = await Designation.findOne({ 
                name, 
                department 
            });
            if (existingDesignation) {
                return res.status(400).json({ 
                    message: 'Designation already exists in this department' 
                });
            }

            const designation = new Designation({
                name,
                description,
                department,
                level,
                createdBy: req.user._id
            });

            await designation.save();
            res.status(201).json(designation);
        } catch (error) {
            logger.error('Create designation error:', error);
            res.status(500).json({ message: 'Failed to create designation' });
        }
    },

    // Update designation
    updateDesignation: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, level } = req.body;

            const designation = await Designation.findById(id);
            if (!designation) {
                return res.status(404).json({ message: 'Designation not found' });
            }

            designation.name = name;
            designation.description = description;
            designation.level = level;
            designation.lastModifiedBy = req.user._id;
            designation.lastModifiedAt = Date.now();

            await designation.save();
            res.json(designation);
        } catch (error) {
            logger.error('Update designation error:', error);
            res.status(500).json({ message: 'Failed to update designation' });
        }
    },

    // Delete designation
    deleteDesignation: async (req, res) => {
        try {
            const { id } = req.params;

            const designation = await Designation.findById(id);
            if (!designation) {
                return res.status(404).json({ message: 'Designation not found' });
            }

            // Check if designation has any associated employees
            const hasEmployees = await User.exists({ designation: id });
            if (hasEmployees) {
                return res.status(400).json({ 
                    message: 'Cannot delete designation with existing employees' 
                });
            }

            await designation.remove();
            res.json({ message: 'Designation deleted successfully' });
        } catch (error) {
            logger.error('Delete designation error:', error);
            res.status(500).json({ message: 'Failed to delete designation' });
        }
    }
};

module.exports = designationController; 