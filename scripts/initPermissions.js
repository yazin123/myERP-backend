const mongoose = require('mongoose');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const RolePermission = require('../models/RolePermission');
const logger = require('../utils/logger');

const defaultPermissions = [
    // Department permissions
    {
        name: 'view_departments',
        description: 'View departments',
        module: 'departments',
        action: 'view'
    },
    {
        name: 'manage_departments',
        description: 'Create, update, and delete departments',
        module: 'departments',
        action: 'manage'
    },
    // Designation permissions
    {
        name: 'view_designations',
        description: 'View designations',
        module: 'designations',
        action: 'view'
    },
    {
        name: 'manage_designations',
        description: 'Create, update, and delete designations',
        module: 'designations',
        action: 'manage'
    },
    // Employee permissions
    {
        name: 'view_employees',
        description: 'View employees',
        module: 'employees',
        action: 'view'
    },
    {
        name: 'manage_employees',
        description: 'Create, update, and delete employees',
        module: 'employees',
        action: 'manage'
    },
    // Role permissions
    {
        name: 'view_roles',
        description: 'View roles',
        module: 'roles',
        action: 'view'
    },
    {
        name: 'manage_roles',
        description: 'Create, update, and delete roles',
        module: 'roles',
        action: 'manage'
    }
];

const initializePermissions = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        logger.info('Connected to MongoDB');

        // Create permissions
        for (const permission of defaultPermissions) {
            await Permission.findOneAndUpdate(
                { name: permission.name },
                permission,
                { upsert: true, new: true }
            );
            logger.info(`Created/Updated permission: ${permission.name}`);
        }

        // Get admin role
        const adminRole = await Role.findOne({ name: 'admin' });
        if (!adminRole) {
            throw new Error('Admin role not found');
        }

        // Assign all permissions to admin role
        const permissions = await Permission.find();
        for (const permission of permissions) {
            await RolePermission.findOneAndUpdate(
                { role: adminRole._id, permission: permission._id },
                {
                    role: adminRole._id,
                    permission: permission._id,
                    granted: true,
                    createdBy: adminRole._id // Using admin role ID as creator
                },
                { upsert: true, new: true }
            );
            logger.info(`Assigned permission ${permission.name} to admin role`);
        }

        logger.info('Successfully initialized permissions');
        process.exit(0);
    } catch (error) {
        logger.error('Error initializing permissions:', error);
        process.exit(1);
    }
};

// Run the initialization
initializePermissions(); 