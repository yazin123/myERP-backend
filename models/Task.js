// models/taskModel.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'review', 'completed', 'blocked'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: Date,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  estimatedHours: {
    type: Number,
    required: true,
    min: 0
  },
  actualHours: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dependencies: [{
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    type: {
      type: String,
      enum: ['blocks', 'requires'],
      required: true
    }
  }],
  subtasks: [{
    title: {
      type: String,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    dueDate: Date
  }],
  attachments: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  comments: [{
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  history: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
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
  },
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1, dueDate: 1 });
taskSchema.index({ title: 'text', description: 'text' });
taskSchema.index({ tags: 1 });

// Middleware to update timestamps
taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Middleware to validate dependencies
taskSchema.pre('save', async function(next) {
  if (this.dependencies && this.dependencies.length > 0) {
    const dependencyIds = this.dependencies.map(dep => dep.task);
    
    // Check for self-dependency
    if (dependencyIds.includes(this._id)) {
      throw new Error('Task cannot depend on itself');
    }
    
    // Check for circular dependencies
    const visited = new Set();
    const visiting = new Set();
    
    async function checkCircular(taskId) {
      if (visiting.has(taskId.toString())) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(taskId.toString())) {
        return;
      }
      
      visiting.add(taskId.toString());
      
      const task = await mongoose.model('Task').findById(taskId).select('dependencies');
      if (task && task.dependencies) {
        for (const dep of task.dependencies) {
          await checkCircular(dep.task);
        }
      }
      
      visiting.delete(taskId.toString());
      visited.add(taskId.toString());
    }
    
    try {
      for (const depId of dependencyIds) {
        await checkCircular(depId);
      }
    } catch (error) {
      next(error);
      return;
    }
  }
  next();
});

// Method to calculate task completion percentage based on subtasks
taskSchema.methods.calculateProgress = function() {
  if (this.subtasks && this.subtasks.length > 0) {
    const completedSubtasks = this.subtasks.filter(subtask => subtask.completed).length;
    this.progress = (completedSubtasks / this.subtasks.length) * 100;
  }
  return this.progress;
};

// Method to check if task is overdue
taskSchema.methods.isOverdue = function() {
  return this.dueDate < new Date() && this.status !== 'completed';
};

// Static method to get tasks by status
taskSchema.statics.getTasksByStatus = function(projectId, status) {
  return this.find({ project: projectId, status })
    .populate('assignee', 'name email photo')
    .populate('createdBy', 'name')
    .sort({ dueDate: 1 });
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;

