

// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  idNumber: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  photo: {
    type: String
  },
  phoneNumber: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['dm', 'creative', 'web', 'seo', 'hr', 'sales', 'delivery', 'accounting', 'superadmin'],
    required: true
  },
  position: {
    type: String,
    enum: ['snr', 'jnr', 'dept lead', 'intern'],
    required: true
  },
  dateOfJoining: {
    type: Date,
    required: true
  },
  resume: {
    type: String  // URL or file path to stored resume
  },
  bankDetails: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['staff', 'team lead', 'admin', 'superadmin'],
    required: true
  },
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  loginDetails: {
    lastLogin: Date,
    loginCount: Number
  },
  payment: {
    type: Number
  },
  salary: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  createdBy: {
    type: String,
  },
  updatedBy: {
    type: String,
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);

