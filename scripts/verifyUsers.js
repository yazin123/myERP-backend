const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const verifyUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({}, {
            name: 1,
            email: 1,
            employeeId: 1,
            password: 1
        });

        for (const user of users) {
            console.log('\nUser Details:');
            console.log('Name:', user.name);
            console.log('Email:', user.email);
            console.log('Employee ID:', user.employeeId);
            console.log('Password Hash Length:', user.password.length);
            console.log('Is Password Hashed:', user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
            
            // Test if the password matches the employee ID
            const isMatch = await bcryptjs.compare(user.employeeId, user.password);
            console.log('Password matches employee ID:', isMatch);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifyUsers(); 