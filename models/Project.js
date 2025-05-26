const mongoose = require('mongoose');

const pointOfContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true }
});

const projectDateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    date: { type: Date, required: true }
});

const historySchema = new mongoose.Schema({
    status: { type: String, required: true },
    datetime: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true }
});

const developmentPhaseSchema = new mongoose.Schema({
    phaseName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'delayed'],
        default: 'pending'
    }
});

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    pointOfContact: [pointOfContactSchema],
    projectHead: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    members: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    }],
    description: { type: String, required: true },
    techStack: [{
        type: String,
        required: true
    }],
    dates: [projectDateSchema],
    history: [historySchema],
    pipeline: {
        requirementGathering: {
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            startDate: Date,
            endDate: Date
    },
        architectCreation: {
    status: {
        type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            startDate: Date,
            endDate: Date
        },
        architectSubmission: {
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            startDate: Date,
            endDate: Date
        },
        developmentPhases: [developmentPhaseSchema]
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
        default: 'planning'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualEndDate: Date,
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: Date
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
projectSchema.index({ name: 1 });
projectSchema.index({ projectHead: 1 });
projectSchema.index({ members: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ techStack: 1 });
projectSchema.index({ 'dates.date': 1 });

// Virtual for tasks associated with this project
projectSchema.virtual('tasks', {
    ref: 'Task',
    localField: '_id',
    foreignField: 'projectId'
});

// Pre-save middleware
projectSchema.pre('save', function(next) {
    // Update history on status change
    if (this.isModified('status')) {
        this.history.push({
            status: this.status,
            datetime: new Date(),
            updatedBy: this.createdBy,
            description: `Project status changed to ${this.status}`
        });
    }

    // Calculate progress based on pipeline stages
    let completedStages = 0;
    let totalStages = 3; // Fixed stages
    
    ['requirementGathering', 'architectCreation', 'architectSubmission'].forEach(stage => {
        if (this.pipeline[stage].status === 'completed') completedStages++;
    });
    
    // Add development phases to total
    totalStages += this.pipeline.developmentPhases.length;
    completedStages += this.pipeline.developmentPhases.filter(phase => 
        phase.status === 'completed'
    ).length;

    this.progress = Math.round((completedStages / totalStages) * 100);
    
    next();
});

// Method to check if a user is project head
projectSchema.methods.isProjectHead = function(userId) {
    return this.projectHead.toString() === userId.toString();
};

// Method to check if a user is team member
projectSchema.methods.isTeamMember = function(userId) {
    return this.members.some(member => member.toString() === userId.toString());
};

// Static method to find projects by tech stack
projectSchema.statics.findByTechStack = function(techStack) {
    return this.find({ techStack: { $in: techStack } });
};

module.exports = mongoose.model('Project', projectSchema);




