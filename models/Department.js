const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    head: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parentDepartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    },
    budget: {
        allocated: {
            type: Number,
            required: true
        },
        spent: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        }
    },
    location: {
        building: String,
        floor: String,
        room: String
    },
    contact: {
        email: String,
        phone: String,
        extension: String
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'restructuring'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes
departmentSchema.index({ name: 'text' });
departmentSchema.index({ head: 1 });
departmentSchema.index({ parentDepartment: 1 });
departmentSchema.index({ status: 1 });

// Virtual for employee count
departmentSchema.virtual('employeeCount', {
    ref: 'User',
    localField: '_id',
    foreignField: 'department',
    count: true
});

// Virtual for project count
departmentSchema.virtual('projectCount', {
    ref: 'Project',
    localField: '_id',
    foreignField: 'department',
    count: true
});

// Pre-save middleware
departmentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Methods
departmentSchema.methods.getSubDepartments = async function() {
    return this.model('Department').find({ parentDepartment: this._id });
};

departmentSchema.methods.getEmployees = async function() {
    return this.model('User').find({ department: this._id });
};

departmentSchema.methods.getProjects = async function() {
    return this.model('Project').find({ department: this._id });
};

departmentSchema.methods.updateBudget = async function(amount, type = 'spent') {
    if (type === 'spent') {
        this.budget.spent += amount;
    } else if (type === 'allocated') {
        this.budget.allocated = amount;
    }
    await this.save();
};

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department; 