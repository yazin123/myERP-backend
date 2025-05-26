// models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

const dailyReportSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    content: { type: String, required: true },
    submissionTime: { type: Date },
    status: {
        type: String,
        enum: ['pending', 'submitted', 'late'],
        default: 'pending'
    }
});

// Bank details schema
const bankDetailsSchema = new mongoose.Schema({
    bankName: String,
    accountNumber: String,
    ifscCode: String
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
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'manager', 'employee', 'intern'],
        required: true
    },

    // Personal Information
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: true
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
    emergencyContact: emergencyContactSchema,

    // Employment Information
    employeeId: {
        type: String,
        unique: true,
        sparse: true
    },
    designation: {
        type: String,
        enum: ['fullstack', 'frontend', 'backend', 'designer', 'hr', 'manager'],
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
        required: true
    },
    salary: {
        type: Number
    },
    bankDetails: bankDetailsSchema,

    // Employee-specific fields
    skills: [{
        type: String
    }],
    resume: resumeSchema,
    attendance: [attendanceSchema],
    performance: [performanceSchema],
    dailyReports: [dailyReportSchema],
    totalPoints: {
        type: Number,
        default: 0
    },
    allowedWifiNetworks: [{
        ssid: String,
        macAddress: String
    }],

    // References
    reportingTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    }],
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    }],

    // System fields
    status: {
        type: String,
        enum: ['active', 'inactive', 'on_leave', 'terminated'],
        default: 'active'
    },
    loginDetails: {
        lastLogin: Date,
        loginCount: Number
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes for better query performance
userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ employeeId: 1 });
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

// Pre-save middleware
userSchema.pre('save', async function(next) {
    try {
        // Hash password if modified
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        
        // Update total points if performance modified
        if (this.isModified('performance')) {
            this.totalPoints = this.performance.reduce((total, p) => total + p.points, 0);
        }

        // Generate employee ID for new employees (not superadmin)
        if (!this.employeeId && this.role !== 'superadmin') {
            this.employeeId = await generateEmployeeId.call(this);
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
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

module.exports = mongoose.model('User', userSchema);

