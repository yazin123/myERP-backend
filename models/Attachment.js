const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    // Which entity this attachment belongs to
    entity: {
        model: {
            type: String,
            enum: ['Project', 'Task', 'Comment', 'ProjectUpdate'],
            required: true
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'entity.model'
        }
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    // For temporary files
    expiresAt: Date
}, {
    timestamps: true
});

// Indexes
attachmentSchema.index({ 'entity.model': 1, 'entity.id': 1 });
attachmentSchema.index({ uploadedBy: 1 });
attachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Clean up file when document is deleted
attachmentSchema.pre('deleteOne', { document: true }, async function(next) {
    try {
        const fs = require('fs').promises;
        const path = require('path');
        await fs.unlink(path.join(__dirname, '..', this.path));
        next();
    } catch (error) {
        next(error);
    }
});

const Attachment = mongoose.model('Attachment', attachmentSchema);

module.exports = Attachment; 