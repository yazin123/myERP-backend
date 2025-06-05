const mongoose = require('mongoose');

const taskReportSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    hoursSpent: {
        type: Number,
        required: true,
        min: 0,
        max: 24
    },
    workDone: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['in_progress', 'completed', 'blocked'],
        required: true
    },
    blockers: {
        type: String,
        required: function() {
            return this.status === 'blocked';
        }
    }
});

const dailyReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    tasks: [taskReportSchema],
    summary: {
        type: String,
        required: true
    },
    totalHours: {
        type: Number,
        required: true,
        min: 0,
        max: 24
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    submissionTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'rejected', 'late'],
        default: 'draft'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvalDate: {
        type: Date
    },
    approvalComments: {
        type: String
    },
    plannedTasksForTomorrow: [{
        description: {
            type: String,
            required: true
        },
        estimatedHours: {
            type: Number,
            required: true,
            min: 0,
            max: 24
        }
    }]
}, {
    timestamps: true
});

// Compound indexes for common queries
dailyReportSchema.index({ user: 1, date: 1 }, { unique: true });
dailyReportSchema.index({ project: 1, date: 1 });
dailyReportSchema.index({ status: 1, date: 1 });

// Middleware to calculate total hours
dailyReportSchema.pre('save', function(next) {
    if (this.tasks && this.tasks.length > 0) {
        this.totalHours = this.tasks.reduce((total, task) => total + task.hoursSpent, 0);
    }
    next();
});

// Middleware to check late submission
dailyReportSchema.pre('save', function(next) {
    const submissionHour = new Date(this.submissionTime).getHours();
    // If submitted after 6 PM (18:00), mark as late
    if (submissionHour >= 18) {
        this.status = 'late';
    }
    next();
});

const DailyReport = mongoose.model('DailyReport', dailyReportSchema);

module.exports = DailyReport; 