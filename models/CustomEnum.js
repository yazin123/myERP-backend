const mongoose = require('mongoose');

const customEnumValueSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true,
        trim: true
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    // For ordering in UI
    order: {
        type: Number,
        default: 0
    },
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

const customEnumSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    // The module this enum belongs to (e.g., 'projects', 'tasks', 'users')
    module: {
        type: String,
        required: true,
        trim: true
    },
    // The type of field (e.g., 'status', 'priority', 'designation')
    type: {
        type: String,
        required: true,
        trim: true
    },
    values: [customEnumValueSchema],
    // Whether this is a system enum that cannot be modified/deleted
    isSystem: {
        type: Boolean,
        default: false
    },
    // Whether this enum is currently in use
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Compound index for module and type
customEnumSchema.index({ module: 1, type: 1 });
customEnumSchema.index({ name: 1 }, { unique: true });

const CustomEnum = mongoose.model('CustomEnum', customEnumSchema);

module.exports = CustomEnum; 