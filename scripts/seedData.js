const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Performance = require('../models/Performance');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Role = require('../models/Role');
require('dotenv').config();

// Sample data arrays
const departments = [
    { name: 'Engineering', code: 'ENG', description: 'Software Development Team' },
    { name: 'Design', code: 'DES', description: 'UI/UX Design Team' },
    { name: 'Human Resources', code: 'HR', description: 'HR Management' },
    { name: 'Project Management', code: 'PM', description: 'Project Management Office' },
    { name: 'Quality Assurance', code: 'QA', description: 'Testing and Quality Control' }
];

const roles = [
    { 
        name: 'admin',
        description: 'System Administrator',
        level: 90,
        isSystem: true,
        canManageRoles: true,
        permissions: ['all']
    },
    { 
        name: 'manager',
        description: 'Department Manager',
        level: 70,
        isSystem: true,
        canManageRoles: false,
        permissions: ['manage_team', 'view_reports', 'edit_tasks']
    },
    { 
        name: 'employee',
        description: 'Regular Employee',
        level: 50,
        isSystem: false,
        canManageRoles: false,
        permissions: ['view_tasks', 'edit_profile']
    },
    { 
        name: 'intern',
        description: 'Intern',
        level: 30,
        isSystem: false,
        canManageRoles: false,
        permissions: ['view_tasks']
    }
];

const designations = [
    { name: 'Software Engineer', level: 3, department: 'Engineering' },
    { name: 'Senior Software Engineer', level: 4, department: 'Engineering' },
    { name: 'UI/UX Designer', level: 3, department: 'Design' },
    { name: 'HR Manager', level: 4, department: 'Human Resources' },
    { name: 'Project Manager', level: 4, department: 'Project Management' },
    { name: 'QA Engineer', level: 3, department: 'Quality Assurance' },
    { name: 'Intern', level: 1, department: 'Engineering' }
];

const skills = [
    'JavaScript', 'Python', 'React', 'Node.js', 'MongoDB',
    'AWS', 'Docker', 'Kubernetes', 'UI/UX', 'Figma',
    'Project Management', 'Agile', 'Scrum', 'Testing',
    'CI/CD', 'Git', 'REST API', 'GraphQL'
];

const getRandomSkills = () => {
    const numSkills = Math.floor(Math.random() * 5) + 2; // 2-6 skills per person
    const shuffled = [...skills].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numSkills);
};

const generateBankDetails = () => ({
    accountName: 'Sample Account',
    accountNumber: Math.random().toString().slice(2, 12),
    bankName: 'Sample Bank',
    branchCode: Math.random().toString().slice(2, 6),
    ifscCode: 'SBIN' + Math.random().toString().slice(2, 7)
});

const generateAttendanceRecords = (startDate) => {
    const records = [];
    const currentDate = new Date();
    let date = new Date(startDate);

    while (date <= currentDate) {
        if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
            const isPresent = Math.random() > 0.1; // 90% attendance rate
            records.push({
                date: new Date(date),
                checkIn: isPresent ? new Date(date.setHours(9, Math.floor(Math.random() * 30), 0)) : null,
                checkOut: isPresent ? new Date(date.setHours(17, 30 + Math.floor(Math.random() * 30), 0)) : null,
                status: isPresent ? 'present' : 'absent',
                wifiValidated: isPresent
            });
        }
        date.setDate(date.getDate() + 1);
    }
    return records;
};

const seedData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Project.deleteMany({});
        await Task.deleteMany({});
        await Performance.deleteMany({});
        await Department.deleteMany({});
        await Designation.deleteMany({});
        await Role.deleteMany({});

        // Create a temporary admin user for initial role creation
        const tempAdminId = new mongoose.Types.ObjectId();

        // Create roles first
        const createdRoles = await Role.create(
            roles.map(role => ({
                ...role,
                createdBy: tempAdminId // Use the temporary admin ID
            }))
        );
        console.log('Created roles:', createdRoles.map(r => r.name).join(', '));

        // Create departments
        const createdDepartments = await Department.create(
            departments.map(dept => ({
                ...dept,
                isActive: true,
                createdBy: tempAdminId // Use the temporary admin ID
            }))
        );

        // Create designations
        const createdDesignations = await Designation.create(
            designations.map(desig => ({
                ...desig,
                department: createdDepartments.find(d => d.name === desig.department)._id,
                isActive: true,
                createdBy: tempAdminId // Use the temporary admin ID
            }))
        );

        // Create users with proper data
        const userDataArray = [
            {
                name: 'John Smith',
                email: 'john.smith@example.com',
                role: 'admin',
                department: 'Engineering',
                designation: 'Senior Software Engineer',
                position: 'lead'
            },
            {
                name: 'Sarah Johnson',
                email: 'sarah.j@example.com',
                role: 'manager',
                department: 'Project Management',
                designation: 'Project Manager',
                position: 'senior'
            },
            {
                name: 'Michael Chen',
                email: 'michael.c@example.com',
                role: 'employee',
                department: 'Engineering',
                designation: 'Software Engineer',
                position: 'senior'
            },
            {
                name: 'Emily Davis',
                email: 'emily.d@example.com',
                role: 'employee',
                department: 'Design',
                designation: 'UI/UX Designer',
                position: 'senior'
            },
            {
                name: 'Alex Turner',
                email: 'alex.t@example.com',
                role: 'employee',
                department: 'Quality Assurance',
                designation: 'QA Engineer',
                position: 'junior'
            },
            {
                name: 'Lisa Wong',
                email: 'lisa.w@example.com',
                role: 'manager',
                department: 'Human Resources',
                designation: 'HR Manager',
                position: 'senior'
            },
            {
                name: 'David Miller',
                email: 'david.m@example.com',
                role: 'intern',
                department: 'Engineering',
                designation: 'Intern',
                position: 'intern'
            }
        ];

        const users = [];
        for (const userData of userDataArray) {
            const dept = createdDepartments.find(d => d.name === userData.department);
            const desig = createdDesignations.find(d => d.name === userData.designation);
            const role = createdRoles.find(r => r.name === userData.role);
            
            const joinDate = new Date();
            joinDate.setMonth(joinDate.getMonth() - Math.floor(Math.random() * 24)); // Random join date within last 2 years

            const user = new User({
                ...userData,
                role: role._id, // Set the role ID instead of the role name
                phone: '+1' + Math.random().toString().slice(2, 11),
                department: dept.name,
                designation: desig.name,
                dateOfJoining: joinDate,
                salary: Math.floor(Math.random() * 50000) + 50000,
                bankDetails: generateBankDetails(),
                skills: getRandomSkills(),
                status: 'active',
                type: userData.role === 'intern' ? 'intern' : 'employee',
                attendance: generateAttendanceRecords(joinDate)
            });

            // Set initial password same as email (will be hashed by middleware)
            user.password = user.email;
            
            await user.save();
            users.push(user);
            console.log(`Created user: ${user.name} with ID: ${user.employeeId}`);
        }

        // Update the createdBy field for roles, departments, and designations with the actual admin user
        const adminUser = users.find(u => u.role.equals(createdRoles.find(r => r.name === 'admin')._id));
        
        for (const role of createdRoles) {
            role.createdBy = adminUser._id;
            await role.save();
        }

        for (const dept of createdDepartments) {
            dept.createdBy = adminUser._id;
            await dept.save();
        }

        for (const desig of createdDesignations) {
            desig.createdBy = adminUser._id;
            await desig.save();
        }

        // Set reporting relationships
        const managerUsers = users.filter(u => u.role.equals(createdRoles.find(r => r.name === 'manager')._id));
        const regularUsers = users.filter(u => !['admin', 'manager'].includes(createdRoles.find(r => r._id.equals(u.role)).name));

        for (const manager of managerUsers) {
            manager.reportingTo = adminUser._id;
            await manager.save();
        }

        for (const user of regularUsers) {
            const manager = managerUsers.find(m => m.department === user.department) || adminUser;
            user.reportingTo = manager._id;
            await user.save();
        }

        console.log('\nTest data has been seeded successfully');
        console.log(`Created ${users.length} users`);
        console.log(`Created ${createdDepartments.length} departments`);
        console.log(`Created ${createdDesignations.length} designations`);
        console.log(`Created ${createdRoles.length} roles`);
        console.log('\nYou can login with any user using their email as the password');
        console.log('Example: john.smith@example.com / john.smith@example.com');
        
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();