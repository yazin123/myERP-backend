const mongoose = require('mongoose');

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

const employeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        unique: true
    },
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
    designation: {
        type: String,
        enum: ['fullstack', 'frontend', 'backend'],
        required: true
    },
    role: {
        type: String,
        enum: ['senior', 'junior', 'intern'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'on_leave', 'terminated'],
        default: 'active'
    },
    department: {
        type: String,
        required: true
    },
    joiningDate: {
        type: Date,
        required: true
    },
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
    reportingTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    projects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ email: 1 });
employeeSchema.index({ designation: 1 });
employeeSchema.index({ role: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ 'attendance.date': 1 });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
    return this.name;
});

// Method to calculate attendance percentage
employeeSchema.methods.calculateAttendancePercentage = function(startDate, endDate) {
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
employeeSchema.methods.calculatePerformanceScore = function(startDate, endDate) {
    const relevantPerformance = this.performance.filter(p => 
        p.date >= startDate && p.date <= endDate
    );
    
    return relevantPerformance.reduce((total, p) => total + p.points, 0);
};

// Method to check daily report submission
employeeSchema.methods.checkDailyReportSubmission = function(date) {
    const report = this.dailyReports.find(r => 
        r.date.toDateString() === date.toDateString()
    );
    
    if (!report) return false;
    
    const submissionTime = report.submissionTime;
    const deadline = new Date(date);
    deadline.setHours(18, 0, 0, 0); // 6:00 PM
    
    return submissionTime <= deadline;
};

// Pre-save middleware to update total points
employeeSchema.pre('save', function(next) {
    if (this.isModified('performance')) {
        this.totalPoints = this.performance.reduce((total, p) => total + p.points, 0);
    }
    next();
});

module.exports = mongoose.model('Employee', employeeSchema); 