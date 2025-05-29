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
    status: {
        type: String,
        required: true
    },
    datetime: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        required: true
    }
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

const timelineEventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['milestone', 'deliverable', 'meeting'],
        default: 'milestone'
    },
    status: {
        type: String,
        enum: ['upcoming', 'in-progress', 'completed'],
        default: 'upcoming'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
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
    description: {
        type: String,
        required: true
    },
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
            completedAt: Date
        },
        architectCreation: {
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            completedAt: Date
        },
        architectSubmission: {
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            completedAt: Date
        },
        developmentPhases: [{
            phaseName: {
                type: String,
                required: true
            },
            status: {
                type: String,
                enum: ['pending', 'in-progress', 'completed'],
                default: 'pending'
            },
            startDate: Date,
            endDate: Date,
            completedAt: Date
        }]
    },
    status: {
        type: String,
        enum: ['created', 'active', 'on-progress', 'stopped', 'completed', 'cancelled'],
        default: 'created'
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
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    completedAt: {
        type: Date
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
    updatedAt: Date,
    memberRoles: {
        type: Map,
        of: {
            type: String,
            enum: ['developer', 'designer', 'tester', 'analyst', 'lead']
        }
    },
    timeline: [timelineEventSchema]
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
projectSchema.index({ 'timeline.date': 1 });

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
        const lastHistory = this.history[this.history.length - 1];
        if (!lastHistory || lastHistory.status !== this.status) {
            this.history.push({
                status: this.status,
                datetime: new Date(),
                updatedBy: this.updatedBy || this.createdBy,
                description: `Project status changed to ${this.status}`
            });
        }
    }

    // Auto-update project status based on pipeline stages
    if (this.isModified('pipeline')) {
        // Check if any pipeline stage is in progress
        const hasInProgressStage = ['requirementGathering', 'architectCreation', 'architectSubmission'].some(
            stage => this.pipeline[stage]?.status === 'in-progress'
        ) || this.pipeline.developmentPhases?.some(phase => phase.status === 'in-progress');

        // Check if all pipeline stages are completed
        const allStagesCompleted = ['requirementGathering', 'architectCreation', 'architectSubmission'].every(
            stage => this.pipeline[stage]?.status === 'completed'
        ) && (this.pipeline.developmentPhases.length === 0 || 
              this.pipeline.developmentPhases.every(phase => phase.status === 'completed'));

        // Check if any phase has started (is either in-progress or completed)
        const hasStartedPhase = ['requirementGathering', 'architectCreation', 'architectSubmission'].some(
            stage => ['in-progress', 'completed'].includes(this.pipeline[stage]?.status)
        ) || this.pipeline.developmentPhases?.some(phase => ['in-progress', 'completed'].includes(phase.status));

        // Only update status if not manually set to stopped or cancelled
        if (!['stopped', 'cancelled'].includes(this.status)) {
            if (allStagesCompleted) {
                this.status = 'completed';
                this.completedAt = new Date();
            } else if (hasInProgressStage) {
                this.status = 'on-progress';
            } else if (hasStartedPhase && this.status === 'created') {
                this.status = 'active';
            }
        }
    }

    // Calculate progress based on pipeline stages
    let completedStages = 0;
    let totalStages = 3;
    
    ['requirementGathering', 'architectCreation', 'architectSubmission'].forEach(stage => {
        if (this.pipeline[stage]?.status === 'completed') completedStages++;
    });
    
    // Add development phases to total
    if (this.pipeline?.developmentPhases?.length) {
        totalStages += this.pipeline.developmentPhases.length;
        completedStages += this.pipeline.developmentPhases.filter(phase => 
            phase.status === 'completed'
        ).length;
    }

    this.progress = Math.round((completedStages / totalStages) * 100);
    
    next();
});

// Virtual for remaining days
projectSchema.virtual('remainingDays').get(function() {
    if (this.status === 'completed') return 0;
    const today = new Date();
    const endDate = new Date(this.endDate);
    const diffTime = endDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for project duration in days
projectSchema.virtual('duration').get(function() {
    const startDate = new Date(this.startDate);
    const endDate = new Date(this.endDate);
    const diffTime = endDate - startDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for completion status
projectSchema.virtual('isCompleted').get(function() {
    return this.status === 'completed';
});

// Virtual for delay status
projectSchema.virtual('isDelayed').get(function() {
    if (this.status === 'completed') return false;
    const today = new Date();
    const endDate = new Date(this.endDate);
    return today > endDate;
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

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;




