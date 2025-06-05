const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Role = require('../models/Role');
const User = require('../models/User');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const Department = require('../models/Department');
const logger = require('../utils/logger');
require('dotenv').config();

const SUPERADMIN_EMAIL = 'superadmin@nesaerp.com';
const SUPERADMIN_PASSWORD = 'SuperAdmin@123';
const SUPERADMIN_NAME = 'Super Administrator';
const SUPERADMIN_PHONE = '+1234567890';
const SUPERADMIN_USERID = 'superadmin';

// List of all system permissions
const systemPermissions = [
    { name: 'manage_users', description: 'Can manage all user operations' },
    { name: 'manage_roles', description: 'Can manage roles and permissions' },
    { name: 'manage_departments', description: 'Can manage departments' },
    { name: 'manage_designations', description: 'Can manage designations' },
    { name: 'manage_projects', description: 'Can manage all projects' },
    { name: 'manage_tasks', description: 'Can manage all tasks' },
    { name: 'view_reports', description: 'Can view all reports' },
    { name: 'manage_system_enums', description: 'Can manage system enumerations' },
    { name: 'manage_settings', description: 'Can manage system settings' },
    { name: 'view_dashboard', description: 'Can view admin dashboard' },
    { name: 'manage_performance', description: 'Can manage performance metrics' },
    { name: 'manage_organization', description: 'Can manage organization structure' }
];

async function initializeSuperAdmin() {
    try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB successfully');

        // Delete any existing superadmin user
        logger.info('Cleaning up existing superadmin...');
        await User.deleteOne({ $or: [{ email: SUPERADMIN_EMAIL }, { userId: SUPERADMIN_USERID }] });

        // Create permissions
        logger.info('Creating system permissions...');
        const permissionDocs = await Promise.all(
            systemPermissions.map(async (perm) => {
                return await Permission.findOneAndUpdate(
                    { name: perm.name },
                    { ...perm, isSystem: true },
                    { upsert: true, new: true }
                );
            })
        );

        // Create superadmin role
        logger.info('Creating superadmin role...');
        const superadminRole = await Role.findOneAndUpdate(
            { name: 'superadmin' },
            {
                name: 'superadmin',
                description: 'Super Administrator with full system access',
                level: 100,
                isSystem: true,
                canManageRoles: true
            },
            { upsert: true, new: true }
        );

        // Create or get Administration department
        logger.info('Creating/Getting Administration department...');
        const tempSuperAdminId = new mongoose.Types.ObjectId(); // Temporary ID for circular reference
        const adminDept = await Department.findOneAndUpdate(
            { name: 'Administration' },
            {
                name: 'Administration',
                description: 'System Administration Department',
                head: tempSuperAdminId, // Will update this later
                status: 'active',
                budget: {
                    allocated: 0,
                    spent: 0,
                    currency: 'USD'
                },
                createdBy: tempSuperAdminId // Will update this later
            },
            { upsert: true, new: true }
        );

        // Create superadmin user
        logger.info('Creating superadmin user...');
        // Don't hash password here, let the model's pre-save middleware handle it
        const superadminUser = await User.create({
            name: SUPERADMIN_NAME,
            email: SUPERADMIN_EMAIL,
            password: SUPERADMIN_PASSWORD, // Plain password, will be hashed by pre-save middleware
            phone: SUPERADMIN_PHONE,
            employeeId: 'SA001',
            userId: SUPERADMIN_USERID,
            role: superadminRole._id,
            department: adminDept._id,
            status: 'active',
            position: 'Super Administrator',
            designation: 'Super Administrator',
            isSystem: true,
            joiningDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Update department with correct references
        logger.info('Updating department references...');
        await Department.findByIdAndUpdate(adminDept._id, {
            head: superadminUser._id,
            createdBy: superadminUser._id
        });

        // Assign all permissions to superadmin role
        logger.info('Assigning permissions to superadmin role...');
        await Promise.all(
            permissionDocs.map(async (permission) => {
                return await RolePermission.findOneAndUpdate(
                    {
                        role: superadminRole._id,
                        permission: permission._id
                    },
                    {
                        role: superadminRole._id,
                        permission: permission._id,
                        granted: true
                    },
                    { upsert: true }
                );
            })
        );

        logger.info('Superadmin initialization completed successfully');
        logger.info('===========================================');
        logger.info('Superadmin credentials:');
        logger.info(`User ID: ${SUPERADMIN_USERID}`);
        logger.info(`Password: ${SUPERADMIN_PASSWORD}`);
        logger.info(`Email: ${SUPERADMIN_EMAIL}`);
        logger.info(`Phone: ${SUPERADMIN_PHONE}`);
        logger.info('Please change the password after first login');
        logger.info('===========================================');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        logger.error('Error during superadmin initialization:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the initialization
initializeSuperAdmin(); 