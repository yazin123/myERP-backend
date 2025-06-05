const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function resetSuperAdminPassword() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find superadmin user
        const superadmin = await User.findOne({ userId: 'NS-EMP-0001' });
        if (!superadmin) {
            console.error('Superadmin user not found');
            process.exit(1);
        }

        // Set the plain password - it will be hashed by the pre-save middleware
        superadmin.password = 'superadmin123';
        await superadmin.save({ validateBeforeSave: false });

        console.log('Successfully reset superadmin password to: superadmin123');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting password:', error);
        process.exit(1);
    }
}

resetSuperAdminPassword();
