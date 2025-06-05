const CustomEnum = require('../../models/CustomEnum');
const EnumService = require('../../services/enumService');
const logger = require('../../utils/logger');

const enumController = {
    // Get all enums
    getAllEnums: async (req, res) => {
        try {
            const enums = await CustomEnum.find()
                .sort('module type');

            res.json({
                success: true,
                data: enums
            });
        } catch (error) {
            logger.error('Get all enums error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch enums'
            });
        }
    },

    // Get enums by module
    getModuleEnums: async (req, res) => {
        try {
            const { module } = req.params;
            const enums = await EnumService.getModuleEnums(module);

            res.json({
                success: true,
                data: enums
            });
        } catch (error) {
            logger.error('Get module enums error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch module enums'
            });
        }
    },

    // Create new enum
    createEnum: async (req, res) => {
        try {
            const { name, description, module, type, values } = req.body;

            // Check if enum already exists
            const existingEnum = await CustomEnum.findOne({ name });
            if (existingEnum) {
                return res.status(400).json({
                    success: false,
                    message: 'Enum already exists'
                });
            }

            // Create new enum
            const customEnum = new CustomEnum({
                name,
                description,
                module,
                type,
                values: values.map((v, index) => ({
                    ...v,
                    order: v.order || index + 1
                })),
                createdBy: req.user._id
            });

            await customEnum.save();

            // Clear enum cache
            EnumService.clearCache();

            res.json({
                success: true,
                data: customEnum
            });
        } catch (error) {
            logger.error('Create enum error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create enum'
            });
        }
    },

    // Update enum
    updateEnum: async (req, res) => {
        try {
            const { name, description, values } = req.body;
            const enumId = req.params.id;

            // Check if enum exists
            const customEnum = await CustomEnum.findById(enumId);
            if (!customEnum) {
                return res.status(404).json({
                    success: false,
                    message: 'Enum not found'
                });
            }

            // Cannot modify system enums
            if (customEnum.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot modify system enums'
                });
            }

            // Update enum
            customEnum.name = name || customEnum.name;
            customEnum.description = description || customEnum.description;
            if (values) {
                customEnum.values = values.map((v, index) => ({
                    ...v,
                    order: v.order || index + 1
                }));
            }
            customEnum.updatedBy = req.user._id;

            await customEnum.save();

            // Clear enum cache
            EnumService.clearCache();

            res.json({
                success: true,
                data: customEnum
            });
        } catch (error) {
            logger.error('Update enum error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update enum'
            });
        }
    },

    // Delete enum
    deleteEnum: async (req, res) => {
        try {
            const enumId = req.params.id;

            // Check if enum exists
            const customEnum = await CustomEnum.findById(enumId);
            if (!customEnum) {
                return res.status(404).json({
                    success: false,
                    message: 'Enum not found'
                });
            }

            // Cannot delete system enums
            if (customEnum.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot delete system enums'
                });
            }

            await customEnum.deleteOne();

            // Clear enum cache
            EnumService.clearCache();

            res.json({
                success: true,
                message: 'Enum deleted successfully'
            });
        } catch (error) {
            logger.error('Delete enum error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete enum'
            });
        }
    },

    // Add enum value
    addEnumValue: async (req, res) => {
        try {
            const { value, label, description, order } = req.body;
            const enumId = req.params.id;

            // Check if enum exists
            const customEnum = await CustomEnum.findById(enumId);
            if (!customEnum) {
                return res.status(404).json({
                    success: false,
                    message: 'Enum not found'
                });
            }

            // Cannot modify system enums
            if (customEnum.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot modify system enums'
                });
            }

            // Check if value already exists
            if (customEnum.values.some(v => v.value === value)) {
                return res.status(400).json({
                    success: false,
                    message: 'Value already exists in enum'
                });
            }

            // Add new value
            customEnum.values.push({
                value,
                label,
                description,
                order: order || customEnum.values.length + 1
            });

            // Sort values by order
            customEnum.values.sort((a, b) => a.order - b.order);

            await customEnum.save();

            // Clear enum cache
            EnumService.clearCache();

            res.json({
                success: true,
                data: customEnum
            });
        } catch (error) {
            logger.error('Add enum value error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add enum value'
            });
        }
    },

    // Update enum value
    updateEnumValue: async (req, res) => {
        try {
            const { value, label, description, order, isActive } = req.body;
            const { id: enumId, valueId } = req.params;

            // Check if enum exists
            const customEnum = await CustomEnum.findById(enumId);
            if (!customEnum) {
                return res.status(404).json({
                    success: false,
                    message: 'Enum not found'
                });
            }

            // Cannot modify system enums
            if (customEnum.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot modify system enums'
                });
            }

            // Find and update value
            const enumValue = customEnum.values.id(valueId);
            if (!enumValue) {
                return res.status(404).json({
                    success: false,
                    message: 'Enum value not found'
                });
            }

            enumValue.value = value || enumValue.value;
            enumValue.label = label || enumValue.label;
            enumValue.description = description || enumValue.description;
            enumValue.order = order || enumValue.order;
            if (typeof isActive === 'boolean') {
                enumValue.isActive = isActive;
            }

            // Sort values by order
            customEnum.values.sort((a, b) => a.order - b.order);

            await customEnum.save();

            // Clear enum cache
            EnumService.clearCache();

            res.json({
                success: true,
                data: customEnum
            });
        } catch (error) {
            logger.error('Update enum value error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update enum value'
            });
        }
    }
};

module.exports = enumController; 