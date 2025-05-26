// scripts/createSuperAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

const createSuperAdmin = async () => {
    try {
        // Check if superadmin already exists
        const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
        
        if (existingSuperAdmin) {
            console.log('Superadmin already exists!');
            process.exit(0);
        }

        // Create superadmin user
        const superadmin = new User({
            userId: 'superadmin',
            password: 'Admin@123', // Will be hashed by the schema middleware
            name: 'Super Admin',
            email: 'superadmin@nesaerp.com',
            phone: '1234567890',
            employeeId: 'SUPER001',
            designation: 'manager',
            department: 'administration',
            position: 'senior',
            role: 'superadmin',
            dateOfJoining: new Date(),
            salary: 0,
            bankDetails: 'N/A',
            status: 'active'
        });

        await superadmin.save();
        
        console.log('Superadmin created successfully!');
        console.log('Login credentials:');
        console.log('Username: superadmin');
        console.log('Password: Admin@123');
        console.log('\nPlease change the password after first login.');
        
        process.exit(0);
    } catch (error) {
        console.error('Failed to create superadmin:', error);
        process.exit(1);
    }
};

// Handle connection events
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

mongoose.connection.once('open', () => {
    console.log('MongoDB connection established');
    createSuperAdmin();
}); 