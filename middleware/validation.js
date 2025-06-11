const { validationResult, body, param, query } = require('express-validator');
const { AppError } = require('./errorHandler');
const Joi = require('joi');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

// Middleware to check validation results
const validate = (validations) => {
    // If validations is an array, it's express-validator chains
    if (Array.isArray(validations)) {
        return async (req, res, next) => {
            try {
                // Run all validations
                await Promise.all(validations.map(validation => validation.run(req)));

                // Check for validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    const messages = errors.array().map(err => `${err.path}: ${err.msg}`);
                    return next(new AppError(400, messages.join(', ')));
                }
                next();
            } catch (error) {
                next(error);
            }
        };
    }
    
    // If validations is an object, it's a Joi schema
    if (validations && typeof validations.validate === 'function') {
        return (req, res, next) => {
            const validationOptions = {
                abortEarly: false,
                allowUnknown: true,
                stripUnknown: true
            };

            const dataToValidate = {
                body: req.body,
                query: req.query,
                params: req.params
            };

            try {
                const { error, value } = validations.validate(dataToValidate, validationOptions);
                
                if (error) {
                    const errorDetails = error.details.map(detail => ({
                        message: detail.message,
                        path: detail.path
                    }));

                    logger.warn('Validation error:', { 
                        path: req.path, 
                        errors: errorDetails 
                    });

                    throw new AppError('Validation Error', 400, errorDetails);
                }

                // Replace request data with validated data
                req.body = value.body;
                req.query = value.query;
                req.params = value.params;

                next();
            } catch (err) {
                next(err);
            }
        };
    }

    // If neither array nor Joi schema, return error
    throw new Error('Invalid validation schema');
};

// Common validation rules
const commonValidations = {
    id: {
        in: ['params', 'body'],
        isMongoId: true,
        errorMessage: 'Invalid ID format'
    },
    email: {
        in: ['body'],
        isEmail: true,
        normalizeEmail: true,
        errorMessage: 'Invalid email address'
    },
    password: {
        in: ['body'],
        isLength: {
            options: { min: 8 },
            errorMessage: 'Password must be at least 8 characters long'
        },
        matches: {
            options: /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/,
            errorMessage: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
        }
    },
    name: {
        in: ['body'],
        isLength: {
            options: { min: 2, max: 50 },
            errorMessage: 'Name must be between 2 and 50 characters'
        },
        trim: true
    },
    date: {
        in: ['body'],
        isISO8601: true,
        toDate: true,
        errorMessage: 'Invalid date format'
    },
    page: {
        in: ['query'],
        optional: true,
        isInt: {
            options: { min: 1 },
            errorMessage: 'Page must be a positive integer'
        },
        toInt: true
    },
    limit: {
        in: ['query'],
        optional: true,
        isInt: {
            options: { min: 1, max: 100 },
            errorMessage: 'Limit must be between 1 and 100'
        },
        toInt: true
    }
};

// Sanitization middleware
const sanitize = (req, res, next) => {
    // Remove any potential XSS attacks from request body
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/[<>]/g, '') // Remove < and >
                    .trim(); // Remove whitespace
            }
        }
    }

    // Remove any potential XSS attacks from query parameters
    if (req.query) {
        for (let key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key]
                    .replace(/[<>]/g, '')
                    .trim();
            }
        }
    }

    next();
};

// Validation chains for different routes
const validationChains = {
    user: {
        create: [
            body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
            body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
            body('password')
                .isLength({ min: 8, max: 30 })
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
            body('department').trim().notEmpty().withMessage('Department is required'),
            body('position').trim().notEmpty().withMessage('Position is required'),
            body('designation').trim().notEmpty().withMessage('Designation is required'),
            body('phone')
                .trim()
                .matches(/^\+?[1-9]\d{1,14}$/)
                .withMessage('Invalid phone number format'),
            body('role').isMongoId().withMessage('Invalid role ID'),
            body('type').isIn(['employee', 'contractor', 'intern']).withMessage('Invalid user type'),
            body('dateOfJoining').isISO8601().toDate().withMessage('Invalid date format'),
            body('status')
                .optional()
                .isIn(['active', 'inactive', 'suspended'])
                .withMessage('Invalid status')
        ],
        update: [
            param('id').isMongoId().withMessage('Invalid user ID'),
            body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
            body('email').optional().trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
            body('department').optional().trim().notEmpty().withMessage('Department cannot be empty'),
            body('position').optional().trim().notEmpty().withMessage('Position cannot be empty'),
            body('designation').optional().trim().notEmpty().withMessage('Designation cannot be empty'),
            body('phone')
                .optional()
                .trim()
                .matches(/^\+?[1-9]\d{1,14}$/)
                .withMessage('Invalid phone number format'),
            body('role').optional().isMongoId().withMessage('Invalid role ID'),
            body('type')
                .optional()
                .isIn(['employee', 'contractor', 'intern'])
                .withMessage('Invalid user type'),
            body('dateOfJoining')
                .optional()
                .isISO8601()
                .toDate()
                .withMessage('Invalid date format'),
            body('status')
                .optional()
                .isIn(['active', 'inactive', 'suspended'])
                .withMessage('Invalid status')
        ],
        getById: [
            param('id').isMongoId().withMessage('Invalid user ID')
        ],
        delete: [
            param('id').isMongoId().withMessage('Invalid user ID')
        ],
        changePassword: [
            body('currentPassword').notEmpty().withMessage('Current password is required'),
            body('newPassword')
                .isLength({ min: 8, max: 30 })
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
        ],
        updateProfile: [
            body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
            body('phone')
                .optional()
                .trim()
                .matches(/^\+?[1-9]\d{1,14}$/)
                .withMessage('Invalid phone number format')
        ]
    },
    project: {
        create: [
            {
                in: ['body'],
                exists: true,
                notEmpty: true,
                errorMessage: 'Project name is required'
            },
            {
                in: ['body'],
                optional: true,
                isLength: {
                    options: { max: 500 },
                    errorMessage: 'Description cannot exceed 500 characters'
                }
            }
        ]
    },
    task: {
        create: [
            {
                in: ['body'],
                exists: true,
                notEmpty: true,
                errorMessage: 'Task title is required'
            },
            commonValidations.date, // due date
            {
                in: ['body'],
                isIn: {
                    options: [['low', 'medium', 'high']],
                    errorMessage: 'Invalid priority level'
                }
            }
        ]
    },
    auth: {
        login: [
            body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
            body('password').notEmpty().withMessage('Password is required')
        ],
        register: [
            body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
            body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email address'),
            body('password')
                .isLength({ min: 8, max: 30 })
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
        ],
        passwordReset: [
            body('password')
                .isLength({ min: 8, max: 30 })
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
                .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
        ]
    }
};

// Common validation schemas
const commonSchemas = {
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
        'string.pattern.base': 'Invalid ID format'
    }),
    
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        sort: Joi.string(),
        search: Joi.string().allow(''),
        fields: Joi.string()
    }),

    dateRange: Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate'))
    })
};

// Auth validation chains
const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    body('remember')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean value')
];

const registerValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
];

const passwordResetValidation = [
    body('password')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
];

// Export validation middlewares
module.exports = {
    validate,
    sanitize,
    commonValidations,
    validationChains,
    validateRequest: validate,
    commonSchemas,
    validateLogin: validate(validationChains.auth.login),
    validateRegister: validate(validationChains.auth.register),
    validatePasswordReset: validate(validationChains.auth.passwordReset),
    validateChangePassword: validate(changePasswordValidation),
    validateProfileUpdate: validate([
        body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
        body('phone')
            .optional()
            .trim()
            .matches(/^\+?[1-9]\d{1,14}$/)
            .withMessage('Invalid phone number format'),
        body('dateOfBirth').optional().isISO8601().toDate().withMessage('Invalid date format'),
        body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
        body('maritalStatus').optional().isIn(['single', 'married', 'divorced', 'widowed']).withMessage('Invalid marital status'),
        body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).withMessage('Invalid blood group'),
        body('address').optional().trim().notEmpty().withMessage('Address cannot be empty'),
        body('emergencyContact.name').optional().trim().notEmpty().withMessage('Emergency contact name is required'),
        body('emergencyContact.relationship').optional().trim().notEmpty().withMessage('Emergency contact relationship is required'),
        body('emergencyContact.phone')
            .optional()
            .trim()
            .matches(/^\+?[1-9]\d{1,14}$/)
            .withMessage('Invalid emergency contact phone number format')
    ])
}; 