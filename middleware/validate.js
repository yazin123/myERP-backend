const { validationResult, body } = require('express-validator');
const { AppError } = require('./errorHandler');

// Middleware to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        return next(new AppError(400, errorMessages.join('. ')));
    }
    next();
};

// Common validation rules
const userValidationRules = {
    createUser: [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('role').optional().isIn(['admin', 'user', 'manager']).withMessage('Invalid role')
    ],
    updateUser: [
        body('email').optional().isEmail().withMessage('Please provide a valid email'),
        body('password').optional()
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
        body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
        body('role').optional().isIn(['admin', 'user', 'manager']).withMessage('Invalid role')
    ]
};

const projectValidationRules = {
    createProject: [
        body('name').trim().notEmpty().withMessage('Project name is required'),
        body('description').optional().trim(),
        body('startDate').isISO8601().withMessage('Invalid start date'),
        body('endDate').optional().isISO8601().withMessage('Invalid end date')
            .custom((value, { req }) => {
                if (value && value < req.body.startDate) {
                    throw new Error('End date must be after start date');
                }
                return true;
            }),
        body('status').optional().isIn(['planning', 'active', 'completed', 'on-hold']).withMessage('Invalid status'),
        body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
        body('assignedUsers').optional().isArray().withMessage('Assigned users must be an array')
    ],
    updateProject: [
        body('name').optional().trim().notEmpty().withMessage('Project name cannot be empty'),
        body('description').optional().trim(),
        body('startDate').optional().isISO8601().withMessage('Invalid start date'),
        body('endDate').optional().isISO8601().withMessage('Invalid end date')
            .custom((value, { req }) => {
                if (value && req.body.startDate && value < req.body.startDate) {
                    throw new Error('End date must be after start date');
                }
                return true;
            }),
        body('status').optional().isIn(['planning', 'active', 'completed', 'on-hold']).withMessage('Invalid status'),
        body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
        body('assignedUsers').optional().isArray().withMessage('Assigned users must be an array')
    ]
};

const taskValidationRules = {
    createTask: [
        body('title').trim().notEmpty().withMessage('Task title is required'),
        body('description').optional().trim(),
        body('projectId').notEmpty().withMessage('Project ID is required'),
        body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
        body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
        body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
        body('status').optional().isIn(['todo', 'in-progress', 'review', 'completed']).withMessage('Invalid status')
    ],
    updateTask: [
        body('title').optional().trim().notEmpty().withMessage('Task title cannot be empty'),
        body('description').optional().trim(),
        body('projectId').optional().notEmpty().withMessage('Project ID cannot be empty'),
        body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
        body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
        body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
        body('status').optional().isIn(['todo', 'in-progress', 'review', 'completed']).withMessage('Invalid status')
    ]
};

module.exports = {
    validate,
    userValidationRules,
    projectValidationRules,
    taskValidationRules
}; 