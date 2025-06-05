const Joi = require('joi');
const mongoose = require('mongoose');

exports.validateTask = (task) => {
  const schema = Joi.object({
    title: Joi.string().required().trim().min(3).max(200),
    description: Joi.string().required().min(10),
    project: Joi.string().required().hex().length(24), // MongoDB ObjectId
    assignee: Joi.string().required().hex().length(24), // MongoDB ObjectId
    status: Joi.string().valid('todo', 'in_progress', 'review', 'completed'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    dueDate: Joi.date().required().greater('now'),
    estimatedHours: Joi.number().required().min(0),
    actualHours: Joi.number().min(0),
    progress: Joi.number().min(0).max(100),
    dependencies: Joi.array().items(
      Joi.string().hex().length(24) // MongoDB ObjectId
    ),
    attachments: Joi.array().items(
      Joi.object({
        filename: Joi.string().required(),
        path: Joi.string().required(),
        uploadedAt: Joi.date(),
        uploadedBy: Joi.string().hex().length(24)
      })
    ),
    comments: Joi.array().items(
      Joi.object({
        text: Joi.string().required(),
        user: Joi.string().hex().length(24)
      })
    )
  });

  return schema.validate(task);
};

exports.validateProject = (project) => {
  const schema = Joi.object({
    name: Joi.string().required().trim().min(3).max(200),
    description: Joi.string().required().min(10),
    startDate: Joi.date().required(),
    endDate: Joi.date().required().greater(Joi.ref('startDate')),
    status: Joi.string().valid('planning', 'in_progress', 'on_hold', 'completed', 'cancelled'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    budget: Joi.object({
      allocated: Joi.number().required().min(0),
      spent: Joi.number().min(0),
      currency: Joi.string().default('USD')
    }),
    progress: Joi.number().min(0).max(100),
    manager: Joi.string().required().hex().length(24),
    team: Joi.array().items(
      Joi.object({
        user: Joi.string().required().hex().length(24),
        role: Joi.string().required().valid('developer', 'designer', 'tester', 'analyst'),
        joinedAt: Joi.date()
      })
    ),
    milestones: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string(),
        dueDate: Joi.date(),
        status: Joi.string().valid('pending', 'in_progress', 'completed', 'delayed'),
        completedAt: Joi.date()
      })
    ),
    documents: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string(),
        fileUrl: Joi.string().required(),
        uploadedBy: Joi.string().hex().length(24),
        uploadedAt: Joi.date()
      })
    ),
    risks: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        severity: Joi.string().required().valid('low', 'medium', 'high', 'critical'),
        mitigation: Joi.string(),
        status: Joi.string().required().valid('identified', 'mitigated', 'occurred', 'resolved'),
        identifiedAt: Joi.date()
      })
    ),
    department: Joi.string().required().hex().length(24),
    tags: Joi.array().items(Joi.string())
  });

  return schema.validate(project);
};

exports.validateDepartment = (department) => {
  const schema = Joi.object({
    name: Joi.string().required().trim().min(3).max(200),
    description: Joi.string().required().min(10),
    head: Joi.string().required().hex().length(24),
    parentDepartment: Joi.string().hex().length(24),
    budget: Joi.object({
      allocated: Joi.number().required().min(0),
      spent: Joi.number().min(0),
      currency: Joi.string().default('USD')
    }),
    location: Joi.object({
      building: Joi.string(),
      floor: Joi.string(),
      room: Joi.string()
    }),
    contact: Joi.object({
      email: Joi.string().email(),
      phone: Joi.string(),
      extension: Joi.string()
    }),
    status: Joi.string().valid('active', 'inactive', 'restructuring')
  });

  return schema.validate(department);
};

exports.validateTimelineEvent = (event) => {
  const schema = Joi.object({
    title: Joi.string().required().trim().min(3).max(200),
    description: Joi.string().trim(),
    date: Joi.date().required(),
    type: Joi.string().valid('milestone', 'deliverable', 'meeting').required(),
    status: Joi.string().valid('upcoming', 'in-progress', 'completed'),
    projectId: Joi.string().required().hex().length(24) // Only required for creation
  });

  return schema.validate(event);
};

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid, false otherwise
 */
const validateObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id);
};

module.exports = {
    validateObjectId
}; 