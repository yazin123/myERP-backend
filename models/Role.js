const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
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
    // Parent role for inheritance
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    // Whether this is a system role that cannot be modified/deleted
    isSystem: {
        type: Boolean,
        default: false
    },
    // Role level for hierarchy (higher number means more privileges)
    level: {
        type: Number,
        required: true,
        min: 0
    },
    // Whether this role can manage other roles
    canManageRoles: {
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

// Only need level index since name is already indexed by unique: true
roleSchema.index({ level: 1 });

const Role = mongoose.model('Role', roleSchema);

module.exports = Role; 