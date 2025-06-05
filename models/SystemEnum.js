const mongoose = require('mongoose');

const systemEnumSchema = new mongoose.Schema({
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
    module: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        trim: true
    },
    values: [{
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
        order: {
            type: Number,
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    isSystem: {
        type: Boolean,
        default: false
    },
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

// Add indexes
systemEnumSchema.index({ name: 1 });
systemEnumSchema.index({ module: 1, type: 1 });
systemEnumSchema.index({ 'values.value': 1 });

const SystemEnum = mongoose.model('SystemEnum', systemEnumSchema);

module.exports = SystemEnum; 