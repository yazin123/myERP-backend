require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const logger = require('../utils/logger');

const clearDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        // Get superadmin role and user IDs before clearing
        const superadminRole = await Role.findOne({ name: 'superadmin' });
        const superadminUser = await User.findOne({ userId: 'SUPERADMIN' });

        if (!superadminRole || !superadminUser) {
            throw new Error('Superadmin role or user not found. Run initializeSystem.js first.');
        }

        // Clear all collections while preserving superadmin
        await Promise.all([
            // Clear users except superadmin
            User.deleteMany({ _id: { $ne: superadminUser._id } }),
            
            // Clear roles except superadmin role
            Role.deleteMany({ _id: { $ne: superadminRole._id } }),
            
            // Clear all permissions and role permissions
            Permission.deleteMany({}),
            RolePermission.deleteMany({}),
            
            // Clear other collections
            mongoose.connection.collection('departments').deleteMany({}),
            mongoose.connection.collection('designations').deleteMany({}),
            mongoose.connection.collection('projects').deleteMany({}),
            mongoose.connection.collection('tasks').deleteMany({}),
            mongoose.connection.collection('activitylogs').deleteMany({}),
            mongoose.connection.collection('notifications').deleteMany({}),
            mongoose.connection.collection('systemenums').deleteMany({})
        ]);

        logger.info('Database cleared successfully while preserving superadmin data');
        
        // Run the initialization script to set up permissions and other required data
        logger.info('Running system initialization...');
        require('./initializeSystem');

    } catch (error) {
        logger.error('Error clearing database:', error);
        process.exit(1);
    }
};

clearDatabase(); 