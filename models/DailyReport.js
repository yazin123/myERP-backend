const mongoose = require('mongoose');

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
    tasks: {
        type: String,
        required: true
    },
    hours: {
        type: Number,
        required: true,
        min: 0,
        max: 24
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
    },
    submissionTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'rejected', 'late'],
        default: 'submitted'
    }
}, {
    timestamps: true
});

// Compound index for unique reports per user per day
dailyReportSchema.index({ user: 1, date: 1 }, { unique: true });

const DailyReport = mongoose.model('DailyReport', dailyReportSchema);

module.exports = DailyReport; 