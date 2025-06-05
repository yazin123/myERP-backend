const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        enum: [
            'create',
            'update',
            'delete',
            'view',
            'download',
            'upload',
            'login',
            'logout',
            'assign',
            'complete',
            'comment',
            'share'
        ],
        required: true
    },
    entity: {
        model: {
            type: String,
            enum: ['Project', 'Task', 'Comment', 'ProjectUpdate', 'User', 'Attachment'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'entity.model'
        }
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        // For storing additional context
        changes: mongoose.Schema.Types.Mixed,
        previousState: mongoose.Schema.Types.Mixed,
        newState: mongoose.Schema.Types.Mixed
    },
    ipAddress: String,
    userAgent: String,
    // For compliance and audit requirements
    retentionPeriod: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for common queries
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ 'entity.model': 1, 'entity.id': 1 });
activityLogSchema.index({ retentionPeriod: 1 });

// Static methods
activityLogSchema.statics.logActivity = async function(user, action, entity, description, metadata = {}, req = null) {
    const activity = {
        user: user._id,
        action,
        entity: {
            model: entity.constructor.modelName,
            id: entity._id
        },
        description,
        metadata
    };

    if (req) {
        activity.ipAddress = req.ip;
        activity.userAgent = req.get('user-agent');
    }

    return this.create(activity);
};

activityLogSchema.statics.getEntityHistory = async function(entityModel, entityId) {
    return this.find({
        'entity.model': entityModel,
        'entity.id': entityId
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
};

activityLogSchema.statics.getUserActivity = async function(userId, startDate, endDate) {
    const query = { user: userId };
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
    }

    return this.find(query)
        .sort({ createdAt: -1 })
        .populate('user', 'name email');
};

// Cleanup old logs
activityLogSchema.statics.cleanupOldLogs = async function() {
    const now = new Date();
    return this.deleteMany({
        retentionPeriod: { $lt: now }
    });
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog; 