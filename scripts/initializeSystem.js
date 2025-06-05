require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const RBACService = require('../services/rbacService');
const EnumService = require('../services/enumService');
const Department = require('../models/Department');
const logger = require('../utils/logger');

const initializeSystem = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Create Administration department first
        const adminDept = await Department.findOneAndUpdate(
            { code: 'ADM' },
            {
                name: 'Administration',
                code: 'ADM',
                description: 'System Administration Department',
                isActive: true,
                // Temporarily set createdBy to null, will update after superadmin creation
                createdBy: null
            },
            { upsert: true, new: true }
        );

        // First create the superadmin role
        const superadminRole = await Role.findOneAndUpdate(
            { name: 'superadmin' },
            {
                name: 'superadmin',
                description: 'Super Administrator with full system access',
                level: 100,
                isSystem: true,
                canManageRoles: true,
                // Temporarily set createdBy to null, will update after user creation
                createdBy: null
            },
            { upsert: true, new: true }
        );

        logger.info('Superadmin role created/updated');

        // Create superadmin user if it doesn't exist
        const superadminUser = await User.findOneAndUpdate(
            { userId: 'SUPERADMIN' },
            {
                name: 'Super Admin',
                email: 'superadmin@nesaerp.com',
                password: await bcryptjs.hash('superadmin123', 10),
                userId: 'SUPERADMIN',
                role: superadminRole._id,
                department: adminDept.name,
                position: 'Super Administrator',
                designation: 'Super Administrator',
                phone: '1234567890',
                status: 'active',
                type: 'employee',
                dateOfJoining: new Date(),
                employeeId: 'SA-001'
            },
            { upsert: true, new: true }
        );

        logger.info('Superadmin user created/updated');

        // Update the superadmin role and department with the correct createdBy
        await Role.findByIdAndUpdate(superadminRole._id, {
            createdBy: superadminUser._id
        });

        await Department.findByIdAndUpdate(adminDept._id, {
            createdBy: superadminUser._id
        });

        // Initialize system roles (this will create admin role)
        await RBACService.initializeSystemRoles(superadminUser);
        logger.info('System roles initialized');

        // Initialize default permissions
        const defaultPermissions = [
            // User management permissions
            {
                name: 'user.create',
                description: 'Create new users',
                module: 'users',
                action: 'create',
                isSystem: true
            },
            {
                name: 'user.read',
                description: 'View user details',
                module: 'users',
                action: 'read',
                isSystem: true
            },
            {
                name: 'user.update',
                description: 'Update user details',
                module: 'users',
                action: 'update',
                isSystem: true
            },
            {
                name: 'user.delete',
                description: 'Delete users',
                module: 'users',
                action: 'delete',
                isSystem: true
            },

            // Project management permissions
            {
                name: 'project.create',
                description: 'Create new projects',
                module: 'projects',
                action: 'create',
                isSystem: true
            },
            {
                name: 'project.read',
                description: 'View project details',
                module: 'projects',
                action: 'read',
                isSystem: true
            },
            {
                name: 'project.update',
                description: 'Update project details',
                module: 'projects',
                action: 'update',
                isSystem: true
            },
            {
                name: 'project.delete',
                description: 'Delete projects',
                module: 'projects',
                action: 'delete',
                isSystem: true
            },

            // Task management permissions
            {
                name: 'task.create',
                description: 'Create new tasks',
                module: 'tasks',
                action: 'create',
                isSystem: true
            },
            {
                name: 'task.read',
                description: 'View task details',
                module: 'tasks',
                action: 'read',
                isSystem: true
            },
            {
                name: 'task.update',
                description: 'Update task details',
                module: 'tasks',
                action: 'update',
                isSystem: true
            },
            {
                name: 'task.delete',
                description: 'Delete tasks',
                module: 'tasks',
                action: 'delete',
                isSystem: true
            },

            // Report permissions
            {
                name: 'report.read',
                description: 'View reports',
                module: 'reports',
                action: 'read',
                isSystem: true
            },
            {
                name: 'report.create',
                description: 'Create reports',
                module: 'reports',
                action: 'create',
                isSystem: true
            },

            // System management permissions
            {
                name: 'system.manage',
                description: 'Manage system settings',
                module: 'system',
                action: 'manage',
                isSystem: true
            },
            {
                name: 'manage_roles',
                description: 'Manage roles and permissions',
                module: 'system',
                action: 'roles',
                isSystem: true
            },
            {
                name: 'roles.manage',
                description: 'Manage roles and permissions',
                module: 'system',
                action: 'roles',
                isSystem: true
            },
            {
                name: 'manage_departments',
                description: 'Manage departments',
                module: 'system',
                action: 'manage_departments',
                isSystem: true
            },
            {
                name: 'manage_designations',
                description: 'Manage designations',
                module: 'system',
                action: 'manage_designations',
                isSystem: true
            },
            {
                name: 'view_monitoring',
                description: 'View system monitoring',
                module: 'system',
                action: 'view_monitoring',
                isSystem: true
            },
            {
                name: 'view_dashboard',
                description: 'View admin dashboard',
                module: 'system',
                action: 'view_dashboard',
                isSystem: true
            },
            {
                name: 'view_performance',
                description: 'View performance metrics',
                module: 'system',
                action: 'view_performance',
                isSystem: true
            }
        ];

        // Create permissions and assign to superadmin
        for (const permData of defaultPermissions) {
            const permission = await Permission.findOneAndUpdate(
                { name: permData.name },
                {
                    ...permData,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            await RolePermission.findOneAndUpdate(
                {
                    role: superadminRole._id,
                    permission: permission._id
                },
                {
                    role: superadminRole._id,
                    permission: permission._id,
                    granted: true,
                    createdBy: superadminUser._id
                },
                { upsert: true }
            );
        }

        logger.info('Default permissions created and assigned to superadmin');

        // Initialize system enums
        await EnumService.initializeSystemEnums(superadminUser);
        logger.info('System enums initialized');

        logger.info('System initialization completed successfully');
        console.log('\nSuperadmin login credentials:');
        console.log('Email: superadmin@nesaerp.com');
        console.log('Password: superadmin123');
        console.log('\nPlease change the password after first login.');
        process.exit(0);
    } catch (error) {
        logger.error('Error initializing system:', error);
        process.exit(1);
    }
};

initializeSystem(); 