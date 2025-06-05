const CustomEnum = require('../models/CustomEnum');
const logger = require('../utils/logger');

class EnumService {
    // Cache for enum values to avoid frequent DB lookups
    static enumCache = new Map();

    // Initialize system enums
    static async initializeSystemEnums(superadminUser) {
        try {
            // Project Status Enum
            await CustomEnum.findOneAndUpdate(
                { name: 'projectStatus' },
                {
                    name: 'projectStatus',
                    description: 'Project status values',
                    module: 'projects',
                    type: 'status',
                    values: [
                        { value: 'created', label: 'Created', order: 1 },
                        { value: 'active', label: 'Active', order: 2 },
                        { value: 'on-progress', label: 'In Progress', order: 3 },
                        { value: 'stopped', label: 'Stopped', order: 4 },
                        { value: 'completed', label: 'Completed', order: 5 },
                        { value: 'cancelled', label: 'Cancelled', order: 6 }
                    ],
                    isSystem: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            // Task Status Enum
            await CustomEnum.findOneAndUpdate(
                { name: 'taskStatus' },
                {
                    name: 'taskStatus',
                    description: 'Task status values',
                    module: 'tasks',
                    type: 'status',
                    values: [
                        { value: 'Assigned', label: 'Assigned', order: 1 },
                        { value: 'Progress', label: 'In Progress', order: 2 },
                        { value: 'Not Completed', label: 'Not Completed', order: 3 },
                        { value: 'Completed', label: 'Completed', order: 4 },
                        { value: 'Missed', label: 'Missed', order: 5 }
                    ],
                    isSystem: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            // Priority Enum
            await CustomEnum.findOneAndUpdate(
                { name: 'priority' },
                {
                    name: 'priority',
                    description: 'Priority levels',
                    module: 'common',
                    type: 'priority',
                    values: [
                        { value: 'Low', label: 'Low', order: 1 },
                        { value: 'Medium', label: 'Medium', order: 2 },
                        { value: 'High', label: 'High', order: 3 },
                        { value: 'Urgent', label: 'Urgent', order: 4 }
                    ],
                    isSystem: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            // User Designations
            await CustomEnum.findOneAndUpdate(
                { name: 'designation' },
                {
                    name: 'designation',
                    description: 'User designations',
                    module: 'users',
                    type: 'designation',
                    values: [
                        { value: 'fullstack', label: 'Full Stack Developer', order: 1 },
                        { value: 'frontend', label: 'Frontend Developer', order: 2 },
                        { value: 'backend', label: 'Backend Developer', order: 3 },
                        { value: 'designer', label: 'Designer', order: 4 },
                        { value: 'hr', label: 'HR', order: 5 },
                        { value: 'manager', label: 'Manager', order: 6 }
                    ],
                    isSystem: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            logger.info('System enums initialized successfully');
        } catch (error) {
            logger.error('Error initializing system enums:', error);
            throw error;
        }
    }

    // Get enum values by name
    static async getEnumValues(enumName) {
        try {
            // Check cache first
            if (this.enumCache.has(enumName)) {
                return this.enumCache.get(enumName);
            }

            const customEnum = await CustomEnum.findOne({ 
                name: enumName,
                isActive: true
            });

            if (!customEnum) {
                throw new Error(`Enum '${enumName}' not found`);
            }

            const values = customEnum.values
                .filter(v => v.isActive)
                .sort((a, b) => a.order - b.order)
                .map(v => ({
                    value: v.value,
                    label: v.label
                }));

            // Cache the result
            this.enumCache.set(enumName, values);

            return values;
        } catch (error) {
            logger.error(`Error getting enum values for '${enumName}':`, error);
            throw error;
        }
    }

    // Get all enums for a module
    static async getModuleEnums(module) {
        try {
            const enums = await CustomEnum.find({
                module,
                isActive: true
            });

            return enums.map(e => ({
                name: e.name,
                description: e.description,
                type: e.type,
                values: e.values
                    .filter(v => v.isActive)
                    .sort((a, b) => a.order - b.order)
            }));
        } catch (error) {
            logger.error(`Error getting enums for module '${module}':`, error);
            throw error;
        }
    }

    // Clear cache
    static clearCache() {
        this.enumCache.clear();
    }
}

module.exports = EnumService; 