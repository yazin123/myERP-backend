const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    content: {
        type: String,
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        index: true
    },
    submissionTime: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'submitted', 'late'],
        default: 'submitted'
    }
}, {
    timestamps: true
});

// Index for common queries
dailyReportSchema.index({ user: 1, date: 1 });
dailyReportSchema.index({ project: 1, date: 1 });

module.exports = mongoose.model('DailyReport', dailyReportSchema); 