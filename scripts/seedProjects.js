const mongoose = require('mongoose');
const Project = require('../models/Project');
const User = require('../models/User');
const Department = require('../models/Department');
require('dotenv').config();

const projectNames = [
    'ERP System Development',
    'Mobile App Development',
    'Website Redesign',
    'Cloud Migration',
    'Data Analytics Platform'
];

const projectDescriptions = [
    'Development of a comprehensive ERP system for business process management',
    'Creating a cross-platform mobile application for customer engagement',
    'Complete redesign of the company website with modern technologies',
    'Migration of existing infrastructure to cloud-based solutions',
    'Building a data analytics platform for business intelligence'
];

const seedProjects = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get users and departments
        const users = await User.find({ type: 'employee' });
        const departments = await Department.find();

        if (!users.length) {
            console.log('No users found. Please seed users first.');
            process.exit(1);
        }

        if (!departments.length) {
            console.log('No departments found. Please seed departments first.');
            process.exit(1);
        }

        // Delete existing projects
        await Project.deleteMany({});
        console.log('Cleared existing projects');

        const projects = [];

        // Create projects
        for (let i = 0; i < projectNames.length; i++) {
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 3));
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + Math.floor(Math.random() * 6) + 3);

            const manager = users[Math.floor(Math.random() * users.length)];
            const projectHead = users[Math.floor(Math.random() * users.length)];
            const department = departments[Math.floor(Math.random() * departments.length)];

            // Create team members (3-6 members per project)
            const teamSize = Math.floor(Math.random() * 4) + 3;
            const team = [];
            const roles = ['developer', 'designer', 'tester', 'analyst'];

            for (let j = 0; j < teamSize; j++) {
                const teamMember = users[Math.floor(Math.random() * users.length)];
                if (!team.find(t => t.user.toString() === teamMember._id.toString())) {
                    team.push({
                        user: teamMember._id,
                        role: roles[Math.floor(Math.random() * roles.length)],
                        joinedAt: startDate
                    });
                }
            }

            projects.push({
                name: projectNames[i],
                description: projectDescriptions[i],
                startDate,
                endDate,
                manager: manager._id,
                projectHead: projectHead._id,
                team,
                department: department._id,
                budget: {
                    allocated: Math.floor(Math.random() * 50000) + 50000,
                    spent: Math.floor(Math.random() * 30000),
                    currency: 'USD'
                },
                progress: Math.floor(Math.random() * 100),
                status: 'in_progress',
                priority: 'high',
                milestones: [
                    {
                        title: 'Project Initiation',
                        description: 'Initial project setup and planning',
                        dueDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
                        status: 'completed'
                    },
                    {
                        title: 'Development Phase 1',
                        description: 'Core functionality development',
                        dueDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000),
                        status: 'in_progress'
                    }
                ],
                createdBy: manager._id,
                pointOfContact: {
                    name: 'John Doe',
                    phone: '+1234567890'
                },
                timeline: [
                    {
                        title: 'Project Started',
                        description: 'Project kickoff meeting completed',
                        date: startDate,
                        type: 'milestone',
                        status: 'completed',
                        createdBy: manager._id
                    }
                ]
            });
        }

        // Insert all projects
        await Project.insertMany(projects);
        console.log(`Seeded ${projects.length} projects`);

        // Update users with project assignments
        for (const project of projects) {
            const teamMemberIds = project.team.map(t => t.user);
            await User.updateMany(
                { _id: { $in: [...teamMemberIds, project.manager] } },
                { $addToSet: { projects: project._id } }
            );
        }
        console.log('Updated user project assignments');

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');

    } catch (error) {
        console.error('Error seeding projects:', error);
        process.exit(1);
    }
};

// Run the seeder
seedProjects(); 