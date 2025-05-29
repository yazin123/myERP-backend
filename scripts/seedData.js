const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Performance = require('../models/Performance');
require('dotenv').config();

// Function to generate sequential employee IDs
const generateEmployeeId = (index) => {
    const companyPrefix = process.env.COMPANY_SHORT_NAME || 'NS';
    return `${companyPrefix}-EMP-${String(index + 1).padStart(4, '0')}`;
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

        // Create users with sequential employee IDs
        const userDataArray = [
            {
                name: 'Admin User',
                email: 'admin@example.com',
                role: 'admin',
                status: 'active',
                position: 'lead',
                department: 'IT',
                designation: 'manager',
                phone: '+1234567890'
            },
            {
                name: 'Project Manager',
                email: 'pm@example.com',
                role: 'manager',
                status: 'active',
                position: 'senior',
                department: 'Project Management',
                designation: 'manager',
                phone: '+1234567891'
            },
            {
                name: 'Developer 1',
                email: 'dev1@example.com',
                role: 'employee',
                status: 'active',
                position: 'senior',
                department: 'Engineering',
                designation: 'fullstack',
                phone: '+1234567892'
            },
            {
                name: 'Developer 2',
                email: 'dev2@example.com',
                role: 'employee',
                status: 'active',
                position: 'junior',
                department: 'Engineering',
                designation: 'backend',
                phone: '+1234567893'
            },
            {
                name: 'Frontend Developer',
                email: 'frontend@example.com',
                role: 'employee',
                status: 'active',
                position: 'senior',
                department: 'Engineering',
                designation: 'frontend',
                phone: '+1234567894'
            },
            {
                name: 'UI/UX Designer',
                email: 'designer@example.com',
                role: 'employee',
                status: 'active',
                position: 'junior',
                department: 'Design',
                designation: 'designer',
                phone: '+1234567895'
            },
            {
                name: 'HR Manager',
                email: 'hr@example.com',
                role: 'manager',
                status: 'active',
                position: 'lead',
                department: 'Human Resources',
                designation: 'hr',
                phone: '+1234567896'
            },
            {
                name: 'Intern Developer',
                email: 'intern@example.com',
                role: 'intern',
                status: 'active',
                position: 'intern',
                department: 'Engineering',
                designation: 'fullstack',
                phone: '+1234567897'
            }
        ];

        // Create users one by one to ensure middleware runs
        const users = [];
        for (const userData of userDataArray) {
            // Create user without password first to get the employee ID
            const user = new User(userData);
            
            // Generate employee ID
            const companyPrefix = process.env.COMPANY_SHORT_NAME || 'NS';
            const latestEmployee = await User.findOne({
                employeeId: { $regex: `^${companyPrefix}-EMP-` }
            }).sort({ employeeId: -1 });

            let nextNumber = 1;
            if (latestEmployee && latestEmployee.employeeId) {
                const currentNumber = parseInt(latestEmployee.employeeId.split('-').pop());
                nextNumber = currentNumber + 1;
            }

            const employeeId = `${companyPrefix}-EMP-${String(nextNumber).padStart(4, '0')}`;
            
            // Set employee ID and use it as the initial password
            user.employeeId = employeeId;
            user.userId = employeeId;
            user.password = employeeId; // This will be hashed by the pre-save middleware
            
            await user.save();
            users.push(user);
            console.log(`Created user: ${user.name} with ID: ${user.employeeId} (initial password is the same as ID)`);
        }

        // Create projects
        const projects = await Project.insertMany([
            {
                name: 'ERP System Development',
                description: 'Development of enterprise resource planning system',
                projectHead: users[1]._id, // PM
                members: [users[2]._id, users[3]._id, users[4]._id], // Developers
                status: 'active',
                priority: 'high',
                progress: 75,
                startDate: new Date(),
                endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                createdBy: users[0]._id,
                techStack: ['Node.js', 'React', 'MongoDB']
            },
            {
                name: 'Mobile App Development',
                description: 'Development of mobile application',
                projectHead: users[1]._id,
                members: [users[2]._id, users[3]._id],
                status: 'on-progress',
                priority: 'medium',
                progress: 30,
                startDate: new Date(),
                endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                createdBy: users[0]._id,
                techStack: ['React Native', 'Firebase']
            },
            {
                name: 'Website Redesign',
                description: 'Redesign of company website',
                projectHead: users[1]._id,
                members: [users[4]._id, users[5]._id], // Frontend dev and designer
                status: 'created',
                priority: 'low',
                progress: 0,
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
                createdBy: users[0]._id,
                techStack: ['Next.js', 'TailwindCSS']
            }
        ]);

        // Create tasks first to get their IDs for performance records
        const tasks = await Task.insertMany([
            {
                description: 'Setup project infrastructure',
                createdBy: users[1]._id,
                assignedTo: users[2]._id, // Senior Fullstack Developer
                project: projects[0]._id,
                status: 'Completed',
                priority: 'High',
                deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            },
            {
                description: 'Implement user authentication',
                createdBy: users[1]._id,
                assignedTo: users[2]._id, // Senior Fullstack Developer
                project: projects[0]._id,
                status: 'Progress',
                priority: 'High',
                deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            },
            {
                description: 'Design database schema',
                createdBy: users[1]._id,
                assignedTo: users[3]._id, // Junior Backend Developer
                project: projects[0]._id,
                status: 'Progress',
                priority: 'Medium',
                deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            },
            {
                description: 'Setup mobile app boilerplate',
                createdBy: users[1]._id,
                assignedTo: users[2]._id, // Senior Fullstack Developer
                project: projects[1]._id,
                status: 'Assigned',
                priority: 'Medium',
                deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
            },
            {
                description: 'Create UI mockups for website',
                createdBy: users[1]._id,
                assignedTo: users[5]._id, // Designer
                project: projects[2]._id,
                status: 'Assigned',
                priority: 'Medium',
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            },
            {
                description: 'Implement responsive frontend',
                createdBy: users[1]._id,
                assignedTo: users[4]._id, // Frontend Developer
                project: projects[2]._id,
                status: 'Assigned',
                priority: 'Low',
                deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            }
        ]);

        // Create performance records
        await Performance.insertMany([
            {
                user_id: users[2]._id, // Senior Fullstack Developer
                createdBy: users[1]._id, // Created by Project Manager
                points: 10,
                category: 'task_completed',
                remark: 'Completed infrastructure setup ahead of schedule',
                taskId: tasks[0]._id
            },
            {
                user_id: users[2]._id, // Senior Fullstack Developer
                createdBy: 'CRON', // System generated
                points: 5,
                category: 'present',
                remark: 'Regular attendance - present for full day'
            },
            {
                user_id: users[3]._id, // Junior Backend Developer
                createdBy: users[1]._id, // Created by Project Manager
                points: 8,
                category: 'task_completed',
                remark: 'Excellent database design implementation',
                taskId: tasks[2]._id
            },
            {
                user_id: users[3]._id, // Junior Backend Developer
                createdBy: 'CRON', // System generated
                points: 3,
                category: 'half_day',
                remark: 'Half day attendance due to medical appointment'
            },
            {
                user_id: users[4]._id, // Frontend Developer
                createdBy: users[1]._id, // Created by Project Manager
                points: 9,
                category: 'task_completed',
                remark: 'Clean and responsive UI implementation'
            },
            {
                user_id: users[4]._id, // Frontend Developer
                createdBy: 'CRON', // System generated
                points: 8,
                category: 'overtime',
                remark: 'Worked overtime to meet project deadline'
            },
            {
                user_id: users[5]._id, // Designer
                createdBy: users[1]._id, // Created by Project Manager
                points: 12,
                category: 'task_completed',
                remark: 'Outstanding UI/UX design concepts'
            },
            {
                user_id: users[5]._id, // Designer
                createdBy: 'CRON', // System generated
                points: 5,
                category: 'present',
                remark: 'Regular attendance - present for full day'
            },
            {
                user_id: users[7]._id, // Intern
                createdBy: users[2]._id, // Created by Senior Developer
                points: -2,
                category: 'task_not_completed',
                remark: 'Failed to complete assigned learning task on time'
            },
            {
                user_id: users[7]._id, // Intern
                createdBy: 'CRON', // System generated
                points: 5,
                category: 'present',
                remark: 'Regular attendance - present for full day'
            },
            {
                user_id: users[6]._id, // HR Manager
                createdBy: 'CRON', // System generated
                points: -5,
                category: 'leave',
                remark: 'Planned leave - annual vacation'
            }
        ]);

        console.log('Test data has been seeded successfully');
        console.log(`Created ${users.length} users with default password: ${users[0].password}`);
        console.log(`Created ${projects.length} projects`);
        console.log('Seed data matches User schema requirements');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

seedData();