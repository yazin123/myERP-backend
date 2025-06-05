const mongoose = require('mongoose');

const projectUpdateSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['general', 'milestone', 'status', 'team', 'deadline', 'budget', 'risk', 'other'],
        default: 'general'
    },
    metadata: {
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    },
    attachments: [{
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        path: String
    }],
    importance: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// Compound indexes for common queries
projectUpdateSchema.index({ project: 1, createdAt: -1 });
projectUpdateSchema.index({ user: 1, createdAt: -1 });
projectUpdateSchema.index({ project: 1, type: 1, createdAt: -1 });

// Ensure project and user exist before saving
projectUpdateSchema.pre('save', async function(next) {
    try {
        const Project = mongoose.model('Project');
        const User = mongoose.model('User');

        const [project, user] = await Promise.all([
            Project.findById(this.project),
            User.findById(this.user)
        ]);

        if (!project) {
            throw new Error('Project not found');
        }
        if (!user) {
            throw new Error('User not found');
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Clean up attachments when update is deleted
projectUpdateSchema.pre('deleteOne', { document: true }, async function(next) {
    try {
        if (this.attachments && this.attachments.length > 0) {
            const fs = require('fs').promises;
            const path = require('path');

            for (const attachment of this.attachments) {
                const filePath = path.join(__dirname, '..', attachment.path);
                try {
                    await fs.unlink(filePath);
                } catch (err) {
                    console.error(`Failed to delete file: ${filePath}`, err);
                }
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

// Virtual for time since update
projectUpdateSchema.virtual('timeSince').get(function() {
    const now = new Date();
    const diff = now - this.createdAt;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
});

// Methods
projectUpdateSchema.methods.addAttachment = async function(file) {
    if (!this.attachments) {
        this.attachments = [];
    }

    const attachment = {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path
    };

    this.attachments.push(attachment);
    await this.save();
    return attachment;
};

projectUpdateSchema.methods.removeAttachment = async function(filename) {
    const attachmentIndex = this.attachments.findIndex(a => a.filename === filename);
    if (attachmentIndex === -1) {
        throw new Error('Attachment not found');
    }

    const attachment = this.attachments[attachmentIndex];
    const fs = require('fs').promises;
    const path = require('path');

    try {
        await fs.unlink(path.join(__dirname, '..', attachment.path));
        this.attachments.splice(attachmentIndex, 1);
        await this.save();
        return true;
    } catch (error) {
        throw new Error('Failed to remove attachment');
    }
};

// Static method to create a status update
projectUpdateSchema.statics.createStatusUpdate = async function(project, user, oldStatus, newStatus) {
    return this.create({
        project,
        user,
        type: 'status',
        content: `Project status changed from ${oldStatus} to ${newStatus}`,
        metadata: {
            oldValue: oldStatus,
            newValue: newStatus
        }
    });
};

// Static method to create a milestone update
projectUpdateSchema.statics.createMilestoneUpdate = async function(project, user, milestone, completed = true) {
    return this.create({
        project,
        user,
        type: 'milestone',
        content: `Project milestone ${completed ? 'completed' : 'started'}: ${milestone}`,
        importance: 'high'
    });
};

const ProjectUpdate = mongoose.model('ProjectUpdate', projectUpdateSchema);

module.exports = ProjectUpdate; 