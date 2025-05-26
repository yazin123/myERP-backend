const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    edited: {
        type: Boolean,
        default: false
    },
    attachments: [{
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        path: String
    }]
}, {
    timestamps: true
});

// Ensure task and user exist before saving
commentSchema.pre('save', async function(next) {
    try {
        const Task = mongoose.model('Task');
        const User = mongoose.model('User');

        const [task, user] = await Promise.all([
            Task.findById(this.task),
            User.findById(this.user)
        ]);

        if (!task) {
            throw new Error('Task not found');
        }
        if (!user) {
            throw new Error('User not found');
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Clean up attachments when comment is deleted
commentSchema.pre('deleteOne', { document: true }, async function(next) {
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

// Virtual for time since comment
commentSchema.virtual('timeSince').get(function() {
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
commentSchema.methods.addAttachment = async function(file) {
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

commentSchema.methods.removeAttachment = async function(filename) {
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

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment; 