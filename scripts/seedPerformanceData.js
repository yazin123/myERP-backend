const mongoose = require('mongoose');
const Performance = require('../models/Performance');
const User = require('../models/User');
const Project = require('../models/Project');
require('dotenv').config();

const categories = [
    'task_completion',
    'code_quality',
    'collaboration',
    'attendance',
    'productivity',
    'innovation'
];

const generateRandomScore = () => {
    return Math.floor(Math.random() * 3) + 8; // Generate scores between 8-10
};

const generateRandomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const seedPerformanceData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get all users and projects
        const users = await User.find({ type: 'employee' });
        const projects = await Project.find();

        if (!users.length) {
            console.log('No users found. Please seed users first.');
            process.exit(1);
        }

        if (!projects.length) {
            console.log('No projects found. Please seed projects first.');
            process.exit(1);
        }

        // Delete existing performance records
        await Performance.deleteMany({});
        console.log('Cleared existing performance records');

        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 3); // Last 3 months of data

        const performanceRecords = [];

        // Generate performance records for each user
        for (const user of users) {
            // Generate 30 records per user (roughly 10 per month)
            for (let i = 0; i < 30; i++) {
                const category = categories[Math.floor(Math.random() * categories.length)];
                const score = generateRandomScore();
                const date = generateRandomDate(startDate, endDate);
                const project = projects[Math.floor(Math.random() * projects.length)];

                performanceRecords.push({
                    period: {
                        startDate: date,
                        endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000) // Next day
                    },
                    user: user._id,
                    project: project._id,
                    metrics: [{
                        category,
                        score,
                        weight: 1
                    }],
                    taskMetrics: {
                        totalAssigned: Math.floor(Math.random() * 10) + 5,
                        completedOnTime: Math.floor(Math.random() * 5) + 3,
                        completedLate: Math.floor(Math.random() * 3),
                        pending: Math.floor(Math.random() * 2)
                    },
                    timeTracking: {
                        totalHoursLogged: Math.floor(Math.random() * 4) + 6,
                        averageHoursPerDay: 8,
                        overtimeHours: Math.floor(Math.random() * 2)
                    },
                    attendance: {
                        present: Math.floor(Math.random() * 2) + 20,
                        absent: Math.floor(Math.random() * 2),
                        halfDay: Math.floor(Math.random() * 2),
                        late: Math.floor(Math.random() * 3)
                    },
                    dailyReportMetrics: {
                        totalSubmitted: Math.floor(Math.random() * 2) + 20,
                        submittedOnTime: Math.floor(Math.random() * 2) + 18,
                        submittedLate: Math.floor(Math.random() * 2),
                        missed: Math.floor(Math.random() * 2)
                    },
                    feedback: [{
                        from: users[Math.floor(Math.random() * users.length)]._id,
                        content: `Great performance in ${category}`,
                        type: 'praise',
                        date: date
                    }],
                    createdBy: 'SYSTEM'
                });
            }
        }

        // Insert all performance records
        await Performance.insertMany(performanceRecords);
        console.log(`Seeded ${performanceRecords.length} performance records`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');

    } catch (error) {
        console.error('Error seeding performance data:', error);
        process.exit(1);
    }
};

// Run the seeder
seedPerformanceData(); 