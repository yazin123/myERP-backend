// models/userModel.js
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const crypto = require('crypto');

const resumeSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now }
});

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

const performanceSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    points: { type: Number, default: 0 },
    category: {
        type: String,
        enum: ['task_completion', 'attendance', 'report_submission', 'other']
    },
    description: String
});

// Bank details schema
const bankDetailsSchema = new mongoose.Schema({
    accountName: {
        type: String,
        trim: true,
        default: null
    },
    accountNumber: {
        type: String,
        trim: true,
        default: null
    },
    bankName: {
        type: String,
        trim: true,
        default: null
    },
    branchCode: {
        type: String,
        trim: true,
        default: null
    },
    ifscCode: {
        type: String,
        trim: true,
        default: null
    }
}, { 
    _id: false,
    strict: true,
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Emergency contact schema
const emergencyContactSchema = new mongoose.Schema({
    name: String,
    relationship: String,
    phone: String
});

const userSchema = new mongoose.Schema({
    // Authentication fields
    userId: {
        type: String,
        required: function() {
            return this.role === 'superadmin';
        },
        index: true
    },
    password: {
        type: String,
        required: function() {
            return this.role === 'superadmin';
        }
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'manager', 'employee', 'intern'],
        required: true,
        default: 'employee'
    },

    // Personal Information
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    photo: {
        type: String
    },
    dateOfBirth: {
        type: Date
    },
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
    emergencyContact: {
        name: String,
        relationship: String,
        phone: String
    },

    // Employment Information
    employeeId: {
        type: String,
        index: true,
        sparse: true
    },
    designation: {
        type: String,
        enum: ['fullstack', 'frontend', 'backend', 'designer', 'hr', 'manager','superadmin'],
        required: true
    },
    department: {
        type: String,
        required: true
    },
    position: {
        type: String,
        enum: ['senior', 'junior', 'intern', 'lead'],
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
    bankDetails: {
        type: mongoose.Schema.Types.Mixed,
        validate: {
            validator: function(value) {
                if (!value) return true;
                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        return parsed && typeof parsed === 'object';
                    } catch (e) {
                        return false;
                    }
                }
                return typeof value === 'object';
            },
            message: 'Bank details must be a valid object or JSON string'
        }
    },
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
    status: {
        type: String,
        enum: ['active', 'inactive', 'on_leave', 'terminated'],
        default: 'active'
    },
    type: {
        type: String,
        enum: ['employee', 'contractor', 'intern'],
        default: 'employee'
    },

    // System fields
    loginDetails: {
        lastLogin: Date,
        loginCount: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },

    // Employee-specific fields
    resume: resumeSchema,
    attendance: [attendanceSchema],
    performance: [performanceSchema],
    totalPoints: {
        type: Number,
        default: 0
    },
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    }],
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    }],

    // New fields from the updated code
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date
}, {
    timestamps: true
});

// Indexes for better query performance
userSchema.index({ designation: 1 });
userSchema.index({ department: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'attendance.date': 1 });

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
            const salt = await bcryptjs.genSalt(10);
            this.password = await bcryptjs.hash(this.password, salt);
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

module.exports = mongoose.model('User', userSchema);

