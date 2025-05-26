const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    // Can be 'system' or user ID
    scope: {
        type: String,
        required: true,
        index: true
    },
    // Settings category
    category: {
        type: String,
        enum: [
            'general',
            'notification',
            'security',
            'display',
            'integration',
            'workflow',
            'customization'
        ],
        required: true
    },
    // The actual settings data
    settings: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // For tracking changes
    version: {
        type: Number,
        default: 1
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index for efficient lookups
settingsSchema.index({ scope: 1, category: 1 }, { unique: true });

// Middleware to increment version on update
settingsSchema.pre('save', function(next) {
    if (this.isModified('settings')) {
        this.version += 1;
    }
    next();
});

// Static methods for system settings
settingsSchema.statics.getSystemSettings = async function(category) {
    return this.findOne({ scope: 'system', category });
};

settingsSchema.statics.updateSystemSettings = async function(category, settings, userId) {
    return this.findOneAndUpdate(
        { scope: 'system', category },
        {
            $set: { settings },
            $inc: { version: 1 },
            lastModifiedBy: userId
        },
        { new: true, upsert: true }
    );
};

// Static methods for user settings
settingsSchema.statics.getUserSettings = async function(userId, category) {
    return this.findOne({ scope: userId.toString(), category });
};

settingsSchema.statics.updateUserSettings = async function(userId, category, settings) {
    return this.findOneAndUpdate(
        { scope: userId.toString(), category },
        {
            $set: { settings },
            $inc: { version: 1 },
            lastModifiedBy: userId
        },
        { new: true, upsert: true }
    );
};

// Get settings history (requires ActivityLog model)
settingsSchema.methods.getHistory = async function() {
    const ActivityLog = mongoose.model('ActivityLog');
    return ActivityLog.find({
        'entity.model': 'Settings',
        'entity.id': this._id
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
};

// Default system settings
settingsSchema.statics.DEFAULT_SYSTEM_SETTINGS = {
    general: {
        companyName: 'My ERP',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h'
    },
    notification: {
        emailEnabled: true,
        slackEnabled: false,
        defaultDigestFrequency: 'daily'
    },
    security: {
        passwordPolicy: {
            minLength: 8,
            requireNumbers: true,
            requireSpecialChars: true
        },
        sessionTimeout: 3600,
        maxLoginAttempts: 5
    },
    workflow: {
        autoAssignTasks: false,
        requireTaskApproval: false,
        defaultTaskPriority: 'medium'
    }
};

// Default user settings
settingsSchema.statics.DEFAULT_USER_SETTINGS = {
    notification: {
        emailDigest: true,
        digestFrequency: 'daily',
        pushNotifications: true
    },
    display: {
        theme: 'light',
        language: 'en',
        itemsPerPage: 20
    },
    workflow: {
        defaultProjectView: 'board',
        defaultTaskView: 'list',
        showCompletedTasks: true
    }
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings; 