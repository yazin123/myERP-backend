const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
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
    // The module this permission belongs to (e.g., 'projects', 'users', 'tasks')
    module: {
        type: String,
        required: true,
        trim: true
    },
    // The action this permission grants (e.g., 'create', 'read', 'update', 'delete')
    action: {
        type: String,
        required: true,
        trim: true
    },
    // Additional conditions for the permission (in JSON format)
    conditions: {
        type: mongoose.Schema.Types.Mixed
    },
    // Whether this is a system permission that cannot be modified/deleted
    isSystem: {
        type: Boolean,
        default: false
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

// Compound index for module and action
permissionSchema.index({ module: 1, action: 1 });

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission; 