require('dotenv').config();
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Project = require('../models/Project');
const Task = require('../models/Task');
const SystemEnum = require('../models/SystemEnum');
const logger = require('../utils/logger');

// Initial data
const departments = [
    { name: 'Administration', code: 'ADM', description: 'System Administration' },
    { name: 'Engineering', code: 'ENG', description: 'Software Development' },
    { name: 'Design', code: 'DES', description: 'UI/UX Design' },
    { name: 'Human Resources', code: 'HR', description: 'HR Management' },
    { name: 'Project Management', code: 'PM', description: 'Project Management' },
    { name: 'Quality Assurance', code: 'QA', description: 'Testing and QA' }
];

const roles = [
    { 
        name: 'superadmin',
        description: 'Super Administrator',
        level: 100,
        isSystem: true,
        canManageRoles: true
    },
    { 
        name: 'admin',
        description: 'Administrator',
        level: 90,
        isSystem: true,
        canManageRoles: true
    },
    { 
        name: 'manager',
        description: 'Department Manager',
        level: 70,
        isSystem: true,
        canManageRoles: false
    },
    { 
        name: 'teamlead',
        description: 'Team Leader',
        level: 60,
        isSystem: false,
        canManageRoles: false
    },
    { 
        name: 'employee',
        description: 'Regular Employee',
        level: 50,
        isSystem: false,
        canManageRoles: false
    }
];

const designations = [
    { name: 'Super Administrator', level: 5, department: 'Administration' },
    { name: 'System Administrator', level: 4, department: 'Administration' },
    { name: 'Software Engineer', level: 3, department: 'Engineering' },
    { name: 'Senior Software Engineer', level: 4, department: 'Engineering' },
    { name: 'UI/UX Designer', level: 3, department: 'Design' },
    { name: 'HR Manager', level: 4, department: 'Human Resources' },
    { name: 'Project Manager', level: 4, department: 'Project Management' },
    { name: 'QA Engineer', level: 3, department: 'Quality Assurance' }
];

const permissions = [
    { name: 'manage_users', description: 'Create, update, and delete users', module: 'users', action: 'manage' },
    { name: 'manage_roles', description: 'Manage user roles', module: 'roles', action: 'manage' },
    { name: 'manage_departments', description: 'Manage departments', module: 'departments', action: 'manage' },
    { name: 'manage_projects', description: 'Manage projects', module: 'projects', action: 'manage' },
    { name: 'manage_tasks', description: 'Manage tasks', module: 'tasks', action: 'manage' },
    { name: 'view_reports', description: 'View system reports', module: 'reports', action: 'view' },
    { name: 'manage_settings', description: 'Manage system settings', module: 'settings', action: 'manage' }
];

// Sample users data
const users = [
    {
        name: 'Admin User',
        email: 'admin@nesaerp.com',
        password: 'admin123',
        phone: '+1987654321',
        role: 'admin',
        department: 'Administration',
        designation: 'System Administrator',
        position: 'Administrator'
    },
    {
        name: 'John Manager',
        email: 'manager@nesaerp.com',
        password: 'manager123',
        phone: '+1876543210',
        role: 'manager',
        department: 'Engineering',
        designation: 'Senior Software Engineer',
        position: 'Engineering Manager'
    },
    {
        name: 'Sarah Lead',
        email: 'lead@nesaerp.com',
        password: 'lead123',
        phone: '+1765432109',
        role: 'teamlead',
        department: 'Engineering',
        designation: 'Senior Software Engineer',
        position: 'Team Lead'
    },
    {
        name: 'Mike Developer',
        email: 'dev@nesaerp.com',
        password: 'dev123',
        phone: '+1654321098',
        role: 'employee',
        department: 'Engineering',
        designation: 'Software Engineer',
        position: 'Developer'
    }
];

// Sample projects data
const projects = [
    {
        name: 'ERP System Development',
        code: 'ERP-2024',
        description: 'Development of the core ERP system with modern technologies',
        type: 'internal',
        priority: 'high',
        status: 'on-progress',
        startDate: new Date(),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
        budget: {
            amount: 150000,
            currency: 'USD'
        },
        department: 'Engineering',
        progress: 35
    },
    {
        name: 'Website Redesign',
        code: 'WEB-2024',
        description: 'Complete redesign of company website with modern UI/UX',
        type: 'internal',
        priority: 'medium',
        status: 'created',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        budget: {
            amount: 50000,
            currency: 'USD'
        },
        department: 'Design',
        progress: 0
    },
    {
        name: 'Mobile App Development',
        code: 'MOB-2024',
        description: 'Development of mobile application for iOS and Android',
        type: 'internal',
        priority: 'high',
        status: 'on-progress',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Started 60 days ago
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        budget: {
            amount: 120000,
            currency: 'USD'
        },
        department: 'Engineering',
        progress: 65
    },
    {
        name: 'HR Management System',
        code: 'HRM-2024',
        description: 'Implementation of new HR management system',
        type: 'internal',
        priority: 'medium',
        status: 'completed',
        startDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // Started 120 days ago
        endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Ended 10 days ago
        budget: {
            amount: 80000,
            currency: 'USD'
        },
        department: 'Human Resources',
        progress: 100
    },
    {
        name: 'Quality Assurance Framework',
        code: 'QAF-2024',
        description: 'Development of automated testing framework',
        type: 'internal',
        priority: 'high',
        status: 'stopped',
        startDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // Started 45 days ago
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        budget: {
            amount: 60000,
            currency: 'USD'
        },
        department: 'Quality Assurance',
        progress: 40
    },
    {
        name: 'Project Management Tool',
        code: 'PMT-2024',
        description: 'Custom project management tool development',
        type: 'internal',
        priority: 'medium',
        status: 'cancelled',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Would have ended in 60 days
        budget: {
            amount: 70000,
            currency: 'USD'
        },
        department: 'Project Management',
        progress: 25
    }
];

const clearDatabase = async () => {
    logger.info('Clearing existing collections...');
    await Promise.all([
        User.deleteMany({}),
        Role.deleteMany({}),
        Permission.deleteMany({}),
        RolePermission.deleteMany({}),
        Department.deleteMany({}),
        Designation.deleteMany({}),
        Project.deleteMany({}),
        Task.deleteMany({}),
        SystemEnum.deleteMany({})
    ]);
    logger.info('Collections cleared successfully');
};

const createSuperAdmin = async () => {
    logger.info('Creating superadmin role...');
    // Create a temporary ID for initial creation
    const tempId = new mongoose.Types.ObjectId();
    
    const superadminRole = await Role.create({
        ...roles[0],
        createdBy: tempId // Temporary ID that will be updated
    });

    logger.info('Creating superadmin user...');
    const superadmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@nesaerp.com',
        password: 'superadmin123', // Will be hashed by the User model middleware
        userId: 'SUPERADMIN',
        employeeId: 'SA001',
        role: superadminRole._id,
        department: 'Administration',
        designation: 'Super Administrator',
        position: 'Super Administrator',
        phone: '+1234567890',
        dateOfJoining: new Date(),
        status: 'active',
        type: 'employee',
        createdBy: tempId // Temporary ID that will be updated
    });

    // Update the role and user with the correct createdBy
    await Role.findByIdAndUpdate(superadminRole._id, { createdBy: superadmin._id });
    await User.findByIdAndUpdate(superadmin._id, { createdBy: superadmin._id });

    return { superadmin, superadminRole };
};

const initializeSystem = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Clear existing data
        await clearDatabase();

        // Create superadmin
        const { superadmin, superadminRole } = await createSuperAdmin();

        // Create departments
        logger.info('Creating departments...');
        const createdDepartments = await Department.create(
            departments.map(dept => ({
                ...dept,
                isActive: true,
                createdBy: superadmin._id
            }))
        );

        // Create roles
        logger.info('Creating roles...');
        const createdRoles = await Role.create(
            roles.slice(1).map(role => ({ // Skip superadmin role as it's already created
                ...role,
                createdBy: superadmin._id
            }))
        );

        // Create designations
        logger.info('Creating designations...');
        const createdDesignations = await Designation.create(
            designations.map(desig => ({
                ...desig,
                department: createdDepartments.find(d => d.name === desig.department)._id,
                isActive: true,
                createdBy: superadmin._id
            }))
        );

        // Create permissions
        logger.info('Creating permissions...');
        const createdPermissions = await Permission.create(
            permissions.map(perm => ({
                ...perm,
                createdBy: superadmin._id
            }))
        );

        // Assign all permissions to superadmin role
        logger.info('Assigning permissions to superadmin...');
        await RolePermission.create(
            createdPermissions.map(perm => ({
                role: superadminRole._id,
                permission: perm._id,
                granted: true,
                createdBy: superadmin._id
            }))
        );

        // Create sample users
        logger.info('Creating sample users...');
        const createdUsers = [];
        for (const userData of users) {
            const role = createdRoles.find(r => r.name === userData.role);
            const dept = createdDepartments.find(d => d.name === userData.department);
            const desig = createdDesignations.find(d => d.name === userData.designation);

            const user = await User.create({
                ...userData,
                userId: `USER${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                employeeId: `EMP${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                role: role._id,
                department: dept.name,
                designation: desig.name,
                dateOfJoining: new Date(),
                status: 'active',
                type: 'employee',
                createdBy: superadmin._id
            });
            createdUsers.push(user);
        }

        // Create sample projects
        logger.info('Creating sample projects...');
        for (const projectData of projects) {
            const dept = createdDepartments.find(d => d.name === projectData.department);
            const manager = createdUsers.find(u => u.role.equals(createdRoles.find(r => r.name === 'manager')._id));
            const teamLead = createdUsers.find(u => u.role.equals(createdRoles.find(r => r.name === 'teamlead')._id));
            const developer = createdUsers.find(u => u.role.equals(createdRoles.find(r => r.name === 'employee')._id));

            await Project.create({
                ...projectData,
                department: dept._id,
                manager: manager._id,
                projectHead: teamLead._id,
                members: [manager._id, teamLead._id, developer._id],
                createdBy: superadmin._id
            });
        }

        logger.info('System initialization completed successfully');
        console.log('\nSuperadmin login credentials:');
        console.log('Username: superadmin');
        console.log('Password: superadmin123');
        console.log('\nOther user credentials:');
        console.log('Admin - admin@nesaerp.com / admin123');
        console.log('Manager - manager@nesaerp.com / manager123');
        console.log('Team Lead - lead@nesaerp.com / lead123');
        console.log('Developer - dev@nesaerp.com / dev123');
        console.log('\nPlease change all passwords after first login.');

        process.exit(0);
    } catch (error) {
        logger.error('Error initializing system:', error);
        process.exit(1);
    }
};

initializeSystem(); 