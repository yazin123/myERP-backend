/**
 * Session Model
 * Handles user sessions and authentication state
 */
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    isValid: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// TTL index for automatic cleanup of old sessions (30 days)
sessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session; 