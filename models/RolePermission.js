const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    permission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
        required: true
    },
    // Whether this permission is granted or explicitly denied
    granted: {
        type: Boolean,
        default: true
    },
    // Additional conditions for this specific role-permission combination
    conditions: {
        type: mongoose.Schema.Types.Mixed
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

// Compound unique index to prevent duplicate role-permission combinations
rolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

module.exports = RolePermission; 