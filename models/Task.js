// models/taskModel.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deadline: {
    type: Date,
  },
  completedDateTime: {
    type: Date
  },
  isDaily: {
    type: Boolean,
    default: true
  },
  isBiweekly: {
    type: Boolean,
    default: false
  },
  isMonthly: {
    type: Boolean,
    default: false
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  status: {
    type: String,
    enum: ['Assigned', 'Progress', 'Not Completed', 'Completed', 'Missed'],
    default: 'Assigned'
  },
  isCompletedApproved: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  files: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Set isDaily to false if deadline is set
taskSchema.pre('save', function (next) {
  if (this.deadline) {
    this.isDaily = false;
  }
  else
  {
    const now = new Date();
    now.setHours(18, 0, 0, 0); // 18 is 6 PM, and we reset minutes, seconds, and milliseconds to 0
    this.deadline = now;
  }
  next();
});

taskSchema.index({ priority: 1, createdAt: -1 });

module.exports = mongoose.model('Task', taskSchema);

