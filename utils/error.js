/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, statusCode, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error response formatter
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @returns {Object} Formatted error response
 */
const formatError = (err, req) => {
    const errorResponse = {
        status: err.status || 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    };

    // Add error details if available
    if (err.details) {
        errorResponse.details = err.details;
    }

    // Add error stack in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    return errorResponse;
};

/**
 * Handle MongoDB duplicate key errors
 * @param {Error} err - MongoDB error
 * @returns {AppError} Formatted application error
 */
const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}. Please use another value.`;
    return new AppError(message, 400);
};

/**
 * Handle MongoDB validation errors
 * @param {Error} err - MongoDB error
 * @returns {AppError} Formatted application error
 */
const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(error => ({
        field: error.path,
        message: error.message
    }));
    return new AppError('Validation Error', 400, errors);
};

/**
 * Handle JWT errors
 * @param {Error} err - JWT error
 * @returns {AppError} Formatted application error
 */
const handleJWTError = (err) => {
    if (err.name === 'JsonWebTokenError') {
        return new AppError('Invalid token. Please log in again.', 401);
    }
    if (err.name === 'TokenExpiredError') {
        return new AppError('Token expired. Please log in again.', 401);
    }
    return err;
};

export default {
    AppError,
    formatError,
    handleDuplicateKeyError,
    handleValidationError,
    handleJWTError
}; 