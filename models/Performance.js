const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
  createdDate: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
    required: true,
    validate: {
      validator: function(value) {
        // Check if value is either a valid ObjectId or the string 'CRON'
        return mongoose.Types.ObjectId.isValid(value) || value === 'CRON';
      },
      message: 'createdBy must be either a valid ObjectId or "CRON"'
    }
  },
  category: {
    type: String,
    enum: [
      'task_completed',
      'task_not_completed',
      'leave',
      'present',
      'half_day',
      'full_day',
      'overtime'
    ],
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  remark: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }
});


performanceSchema.pre('save', function(next) {
  // If createdBy is an ObjectId, set the ref to 'User'
  if (mongoose.Types.ObjectId.isValid(this.createdBy)) {
    this.populate('createdBy');
  }
  next();
});


module.exports = mongoose.model('Performance', performanceSchema);