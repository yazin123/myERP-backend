const { validationResult, body, param, query } = require('express-validator');
const { AppError } = require('./errorHandler');

// Middleware to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(err => `${err.path}: ${err.msg}`);
        throw new AppError(400, messages.join(', '));
    }
    next();
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
            commonValidations.email,
            commonValidations.password,
            commonValidations.name
        ],
        update: [
            commonValidations.id,
            {
                ...commonValidations.email,
                optional: true
            },
            {
                ...commonValidations.password,
                optional: true
            },
            {
                ...commonValidations.name,
                optional: true
            }
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
    }
};

module.exports = {
    validate,
    sanitize,
    commonValidations,
    validationChains
}; 