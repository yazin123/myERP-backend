// models/Lead.js
const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    photo: { type: String }, // URL/path to photo
    companyName: { type: String },
    companyPhoto: { type: String },
    companyAddress: { type: String },
    companyMail: { type: String },
    companyContact: { type: String },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    status: {
        type: String,
        enum: ['cold', 'hot', 'closed', 'reopened','lost'],
        default: 'cold'
    },
    statusHistory: [{
        status: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
    dateCreated: { type: Date, default: Date.now },
    leadOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    access: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });



module.exports = mongoose.model('Lead', leadSchema);
