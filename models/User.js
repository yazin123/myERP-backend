// models/userModel.js
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');
const { hashPassword } = require('../utils/password');

/**
 * Resume Schema Definition
 * Stores information about user's resume/CV
 */
const resumeSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now }
});

/**
 * Attendance Schema Definition
 * Tracks daily attendance records
 */
const attendanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    wifiValidated: { type: Boolean, default: false },
    wifiSSID: String,
    status: {
        type: String,
        enum: ['present', 'absent', 'half-day', 'leave'],
        default: 'absent'
    }
});

/**
 * Performance Schema Definition
 * Tracks employee performance metrics
 */
const performanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    points: { type: Number, default: 0 },
    category: {
        type: String,
        enum: ['task_completion', 'attendance', 'report_submission', 'other']
    },
    description: String
});

/**
 * Bank Details Schema Definition
 * Stores employee bank account information
 */
const bankDetailsSchema = new mongoose.Schema({
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    bankName: { type: String, trim: true },
    branchCode: { type: String, trim: true },
    ifscCode: { type: String, trim: true }
}, { 
    _id: false,
    strict: true
});

/**
 * Emergency Contact Schema Definition
 * Stores emergency contact information
 */
const emergencyContactSchema = new mongoose.Schema({
    name: String,
    relationship: String,
    phone: String
}, { _id: false });

/**
 * User Schema Definition
 * Main schema for storing user/employee information
 */
const userSchema = new mongoose.Schema({
    // Authentication fields
    userId: {
        type: String,
        required: function() {
            return this.role === 'superadmin';
        }
    },
    password: {
        type: String,
        required: function() {
            return this.role === 'superadmin';
        },
        select: false
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true,
        index: true
    },

    // Personal Information
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    photo: String,
    dateOfBirth: Date,
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    maritalStatus: {
        type: String,
        enum: ['single', 'married', 'divorced', 'widowed']
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
    },
    address: String,
    emergencyContact: emergencyContactSchema,

    // Employment Information
    employeeId: {
        type: String,
        sparse: true
    },
    designation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Designation',
        required: true
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true
    },
    position: {
        type: String,
        required: true
    },
    dateOfJoining: {
        type: Date,
        required: true,
        default: Date.now
    },
    salary: {
        type: Number,
        min: 0
    },
    bankDetails: bankDetailsSchema,
    skills: [{
        type: String,
        trim: true
    }],
    reportingTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    allowedWifiNetworks: [{
        ssid: String,
        macAddress: String
    }],

    // System fields
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: Date,
    tokenVersion: {
        type: Number,
        default: 0
    },
    twoFactorSecret: {
        type: String,
        select: false
    },
    backupCodes: [{
        code: String,
        used: Boolean
    }],
    attendance: [attendanceSchema],
    performance: [performanceSchema],
    resume: resumeSchema
}, {
    timestamps: true
});

// Create compound indexes for better query performance
userSchema.index({ department: 1, designation: 1 });
userSchema.index({ 'attendance.date': 1 });
userSchema.index({ isActive: 1, role: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return this.name;
});

// Function to generate employee ID
async function generateEmployeeId() {
    const companyPrefix = process.env.COMPANY_SHORT_NAME || 'NS';
    const latestEmployee = await this.constructor.findOne({
        employeeId: { $regex: `^${companyPrefix}-EMP-` }
    }).sort({ employeeId: -1 });

    let nextNumber = 1;
    if (latestEmployee && latestEmployee.employeeId) {
        const currentNumber = parseInt(latestEmployee.employeeId.split('-').pop());
        nextNumber = currentNumber + 1;
    }

    return `${companyPrefix}-EMP-${String(nextNumber).padStart(4, '0')}`;
}

// Pre-validate middleware to set employeeId and userId
userSchema.pre('validate', async function(next) {
    try {
        // Only for new non-superadmin users
        if (this.isNew && this.role !== 'superadmin') {
            // Generate the employeeId
            this.employeeId = await generateEmployeeId.call(this);
            
            // Set userId to be the same as employeeId
            this.userId = this.employeeId;
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware for password hashing and other operations
userSchema.pre('save', async function(next) {
    try {
        console.log('Pre-save middleware running');
        console.log('Is password modified:', this.isModified('password'));
        console.log('Original password:', this.password);
        
        // Hash password if modified
        if (this.isModified('password')) {
            console.log('Hashing password...');
            this.password = await hashPassword(this.password);
            console.log('Password hashed:', this.password);
            
            // Update passwordChangedAt when password is changed
            this.passwordChangedAt = Date.now() - 1000;
        }
        
        // Update total points if performance modified
        if (this.isModified('performance')) {
            this.totalPoints = this.performance.reduce((total, p) => total + p.points, 0);
        }

        // Handle bank details
        if (this.isModified('bankDetails')) {
            if (!this.bankDetails || this.bankDetails === 'N/A' || 
                (typeof this.bankDetails === 'object' && Object.keys(this.bankDetails).length === 0)) {
                this.bankDetails = null;
            }
        }

        next();
    } catch (error) {
        console.error('Error in pre-save middleware:', error);
        next(error);
    }
});

// Static method to format bank details
userSchema.statics.formatBankDetails = function(details) {
    if (!details || details === 'N/A' || (typeof details === 'object' && Object.keys(details).length === 0)) {
        return null;
    }
    return details;
};

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcryptjs.compare(candidatePassword, this.password);
};

// Method to calculate attendance percentage
userSchema.methods.calculateAttendancePercentage = function(startDate, endDate) {
    const relevantAttendance = this.attendance.filter(a => 
        a.date >= startDate && a.date <= endDate
    );
    
    const totalDays = relevantAttendance.length;
    const presentDays = relevantAttendance.filter(a => 
        a.status === 'present' || a.status === 'half-day'
    ).length;
    
    return totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
};

// Method to calculate performance score
userSchema.methods.calculatePerformanceScore = function(startDate, endDate) {
    const relevantPerformance = this.performance.filter(p => 
        p.date >= startDate && p.date <= endDate
    );
    
    return relevantPerformance.reduce((total, p) => total + p.points, 0);
};

// Method to check daily report submission
userSchema.methods.checkDailyReportSubmission = function(date) {
    const report = this.dailyReports.find(r => 
        r.date.toDateString() === date.toDateString()
    );
    
    if (!report) return false;
    
    const submissionTime = report.submissionTime;
    const deadline = new Date(date);
    deadline.setHours(18, 0, 0, 0); // 6:00 PM
    
    return submissionTime <= deadline;
};

// Methods from the updated code
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return resetToken;
};

userSchema.methods.incrementLoginAttempts = async function() {
    // If lock has expired, reset attempts and remove lock
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: {
                loginAttempts: 1
            },
            $unset: {
                lockUntil: 1
            }
        });
    }

    // Otherwise increment attempts
    const updates = {
        $inc: {
            loginAttempts: 1
        }
    };

    // Lock account if attempts reach 5
    if (this.loginAttempts + 1 >= 5) {
        updates.$set = {
            lockUntil: Date.now() + 60 * 60 * 1000 // 1 hour lock
        };
    }

    return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
    if (!this.address) return '';
    
    const parts = [
        this.address.street,
        this.address.city,
        this.address.state,
        this.address.country,
        this.address.postalCode
    ];
    
    return parts.filter(Boolean).join(', ');
});

// Add method to check if user has permission
userSchema.methods.hasPermission = async function(permissionName) {
    const RBACService = require('../services/rbacService');
    return await RBACService.hasPermission(this, permissionName);
};

// Update getRoleLevel method to use populated role or fetch it if needed
userSchema.methods.getRoleLevel = async function() {
    if (this.role.level !== undefined) {
        return this.role.level;
    }
    const RBACService = require('../services/rbacService');
    return await RBACService.getRoleLevel(this.role);
};

// Add method to compare role with another role
userSchema.methods.compareRoleWith = async function(otherRole) {
    const RBACService = require('../services/rbacService');
    return await RBACService.compareRoles(this.role, otherRole);
};

// Instance methods
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.tokenVersion;
    delete user.twoFactorSecret;
    delete user.tempTwoFactorSecret;
    delete user.backupCodes;
    return user;
};

module.exports = mongoose.model('User', userSchema);

