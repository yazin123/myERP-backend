// models/Followup.js
const mongoose = require('mongoose');

const followupSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    createdTime: { type: Date, default: Date.now },
    updatedDateTime: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    files: [{ type: String }],
    method: {
        type: String,
        enum: ['call', 'meeting'],
        required: true
    },
    isResponded: { type: Boolean, default: false },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    followupDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['created', 'missed'],
        default: 'created'
    }
}, { timestamps: true });


module.exports = mongoose.model('Followup', followupSchema);