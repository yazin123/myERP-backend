const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Designation name is required'],
        trim: true,
        index: false
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: [true, 'Department is required']
    },
    description: {
        type: String,
        trim: true
    },
    level: {
        type: Number,
        required: [true, 'Level is required'],
        min: [0, 'Level must be at least 0'],
        max: [10, 'Level cannot exceed 10']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound index for unique designation name within a department
designationSchema.index({ name: 1, department: 1 }, { unique: true });

// Middleware to update lastModifiedAt
designationSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        this.lastModifiedAt = new Date();
    }
    next();
});

// Virtual for getting employee count
designationSchema.virtual('employeeCount', {
    ref: 'User',
    localField: '_id',
    foreignField: 'designation',
    count: true
});

// Ensure virtuals are included in JSON output
designationSchema.set('toJSON', { virtuals: true });
designationSchema.set('toObject', { virtuals: true });

const Designation = mongoose.model('Designation', designationSchema);

module.exports = Designation; 