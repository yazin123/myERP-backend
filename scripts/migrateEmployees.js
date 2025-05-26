// scripts/migrateEmployees.js
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

const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
};

const migrateEmployees = async () => {
    try {
        // Get all employees from the old collection using Mongoose
        const Employee = mongoose.model('Employee', new mongoose.Schema({}), 'employees');
        const employees = await Employee.find({}).lean();
        
        console.log(`Found ${employees.length} employees to migrate`);

        // Migrate each employee
        for (const employee of employees) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({
                    $or: [
                        { email: employee.email },
                        { employeeId: employee.employeeId }
                    ]
                });

                if (existingUser) {
                    console.log(`Skipping ${employee.name} - User already exists`);
                    continue;
                }

                // Generate initial credentials
                const tempPassword = generateRandomPassword();
                const userId = employee.email.split('@')[0]; // Use email prefix as userId

                // Create new user from employee data
                const user = new User({
                    userId,
                    password: tempPassword, // Will be hashed by the schema middleware
                    name: employee.name,
                    email: employee.email,
                    phone: employee.phone,
                    employeeId: employee.employeeId,
                    designation: employee.designation,
                    department: employee.department,
                    position: employee.role === 'senior' ? 'senior' : 
                             employee.role === 'junior' ? 'junior' : 'intern',
                    role: 'employee', // Default role
                    dateOfJoining: employee.joiningDate,
                    skills: employee.skills || [],
                    resume: employee.resume,
                    attendance: employee.attendance || [],
                    performance: employee.performance || [],
                    dailyReports: employee.dailyReports || [],
                    totalPoints: employee.totalPoints || 0,
                    allowedWifiNetworks: employee.allowedWifiNetworks || [],
                    reportingTo: employee.reportingTo,
                    projects: employee.projects || [],
                    tasks: [],
                    status: employee.status || 'active',
                    // Set some reasonable defaults for required fields
                    salary: 0, // Should be updated by admin
                    bankDetails: 'Pending update' // Should be updated by admin
                });

                await user.save();
                console.log(`Migrated ${employee.name} - Temporary password: ${tempPassword}`);
            } catch (error) {
                console.error(`Failed to migrate employee ${employee.name}:`, error);
            }
        }

        console.log('Migration completed');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
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
    migrateEmployees();
}); 