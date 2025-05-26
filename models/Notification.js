const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: [
            'project_update',
            'task_assigned',
            'task_completed',
            'comment_added',
            'mention',
            'deadline_approaching',
            'milestone_reached',
            'team_change',
            'status_change',
            'risk_alert',
            'system_alert'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    importance: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: Date,
    // Reference to related entities
    reference: {
        model: {
            type: String,
            enum: ['Project', 'Task', 'Comment', 'ProjectUpdate'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'reference.model'
        }
    },
    // For tracking notification delivery
    delivery: {
        email: {
            sent: Boolean,
            sentAt: Date,
            error: String
        },
        inApp: {
            displayed: Boolean,
            displayedAt: Date
        },
        slack: {
            sent: Boolean,
            sentAt: Date,
            error: String
        }
    },
    // For grouping related notifications
    group: {
        type: String,
        index: true
    },
    // For temporary notifications
    expiresAt: {
        type: Date,
        index: true
    }
}, {
    timestamps: true
});

// Indexes for common queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ 'reference.model': 1, 'reference.id': 1 });

// Methods
notificationSchema.methods.markAsRead = async function() {
    this.read = true;
    this.readAt = new Date();
    await this.save();
    return this;
};

notificationSchema.methods.markAsUnread = async function() {
    this.read = false;
    this.readAt = undefined;
    await this.save();
    return this;
};

notificationSchema.methods.trackDelivery = async function(channel, success, error = null) {
    const now = new Date();
    
    if (channel === 'email') {
        this.delivery.email = {
            sent: success,
            sentAt: success ? now : undefined,
            error: error
        };
    } else if (channel === 'inApp') {
        this.delivery.inApp = {
            displayed: success,
            displayedAt: success ? now : undefined
        };
    } else if (channel === 'slack') {
        this.delivery.slack = {
            sent: success,
            sentAt: success ? now : undefined,
            error: error
        };
    }

    await this.save();
    return this;
};

// Static methods
notificationSchema.statics.createProjectNotification = async function(recipient, project, type, content, importance = 'medium') {
    return this.create({
        recipient,
        type,
        title: `Project: ${project.name}`,
        content,
        importance,
        reference: {
            model: 'Project',
            id: project._id
        }
    });
};

notificationSchema.statics.createTaskNotification = async function(recipient, task, type, content, importance = 'medium') {
    return this.create({
        recipient,
        type,
        title: `Task: ${task.title}`,
        content,
        importance,
        reference: {
            model: 'Task',
            id: task._id
        }
    });
};

notificationSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({
        recipient: userId,
        read: false
    });
};

notificationSchema.statics.markAllAsRead = async function(userId, type = null) {
    const query = {
        recipient: userId,
        read: false
    };

    if (type) {
        query.type = type;
    }

    const now = new Date();
    return this.updateMany(query, {
        $set: {
            read: true,
            readAt: now
        }
    });
};

// Cleanup expired notifications
notificationSchema.statics.cleanupExpired = async function() {
    const now = new Date();
    return this.deleteMany({
        expiresAt: { $lt: now }
    });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 