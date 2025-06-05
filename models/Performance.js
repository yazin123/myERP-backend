const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
    category: {
        type: String,
        enum: [
            'task_completion',
            'code_quality',
            'collaboration',
            'attendance',
            'productivity',
            'innovation'
        ],
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 10
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    }
});

const performanceSchema = new mongoose.Schema({
    period: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        }
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    metrics: [metricSchema],
    taskMetrics: {
        totalAssigned: {
            type: Number,
            default: 0
        },
        completedOnTime: {
            type: Number,
            default: 0
        },
        completedLate: {
            type: Number,
            default: 0
        },
        pending: {
            type: Number,
            default: 0
        }
    },
    timeTracking: {
        totalHoursLogged: {
            type: Number,
            default: 0
        },
        averageHoursPerDay: {
            type: Number,
            default: 0
        },
        overtimeHours: {
            type: Number,
            default: 0
        }
    },
    attendance: {
        present: {
            type: Number,
            default: 0
        },
        absent: {
            type: Number,
            default: 0
        },
        halfDay: {
            type: Number,
            default: 0
        },
        late: {
            type: Number,
            default: 0
        }
    },
    dailyReportMetrics: {
        totalSubmitted: {
            type: Number,
            default: 0
        },
        submittedOnTime: {
            type: Number,
            default: 0
        },
        submittedLate: {
            type: Number,
            default: 0
        },
        missed: {
            type: Number,
            default: 0
        }
    },
    overallScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    feedback: [{
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['praise', 'improvement', 'general'],
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function(value) {
                return mongoose.Types.ObjectId.isValid(value) || value === 'SYSTEM';
            },
            message: 'createdBy must be either a valid ObjectId or "SYSTEM"'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for better query performance
performanceSchema.index({ user: 1, 'period.startDate': 1, 'period.endDate': 1 });
performanceSchema.index({ project: 1, 'period.startDate': 1 });
performanceSchema.index({ overallScore: -1 });

// Calculate overall score before saving
performanceSchema.pre('save', function(next) {
    if (this.metrics && this.metrics.length > 0) {
        const totalWeightedScore = this.metrics.reduce((total, metric) => {
            return total + (metric.score * metric.weight);
        }, 0);
        
        const totalWeight = this.metrics.reduce((total, metric) => total + metric.weight, 0);
        this.overallScore = (totalWeightedScore / totalWeight) * 10;
    }
    next();
});

// Static method to get performance trends
performanceSchema.statics.getPerformanceTrend = async function(userId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                user: mongoose.Types.ObjectId(userId),
                'period.startDate': { $gte: startDate },
                'period.endDate': { $lte: endDate }
            }
        },
        {
            $sort: { 'period.startDate': 1 }
        },
        {
            $project: {
                period: 1,
                overallScore: 1,
                taskMetrics: 1,
                timeTracking: 1,
                attendance: 1
            }
        }
    ]);
};

const Performance = mongoose.model('Performance', performanceSchema);

module.exports = Performance;