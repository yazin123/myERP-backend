const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    files: {
        type: [{
            name: { type: String },
            filedata: { type: String },
            filetype: {
                type: String,
                enum: ['image', 'pdf', 'document', 'video', 'other'],
            },
        }],
        default: [],
    },
    status: {
        type: String,
        enum: ['pending', 'started', 'closed', 'reopened', 'lost'],
        default: 'pending',
    },
    statusHistory: {
        type: [{
            status: {
                type: String,
                enum: ['pending', 'started', 'closed', 'reopened', 'lost'],
            },
            description: { type: String },
            timestamp: { type: Date, default: Date.now },
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        }],
        default: [],
    },
    completionDate: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return value > new Date();
            },
            message: 'Completion date must be in the future.',
        },
    },
    dateCreated: { type: Date, default: Date.now },
    projectOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    access: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assigned_to: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Add indexes
projectSchema.index({ leadId: 1 });
projectSchema.index({ projectOwner: 1 });
projectSchema.index({ status: 1 });

// Pre-save hook for statusHistory
projectSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        this.statusHistory.push({
            status: this.status,
            description: `Status changed to ${this.status}`,
            createdBy: this.createdBy,
        });
    }
    next();
});

module.exports = mongoose.model('Project', projectSchema);




