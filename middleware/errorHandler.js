// middleware/errorHandler.js
const logger = require('../utils/logger');

class AppError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error
    logger.error({
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        user: req.user ? req.user._id : 'anonymous'
    });

    let responseBody;

    if (process.env.NODE_ENV === 'development') {
        responseBody = {
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        };
    } else {
        // Production mode
        if (err.isOperational) {
            // Operational, trusted error: send message to client
            responseBody = {
                status: err.status,
                message: err.message
            };
        } else {
            // Programming or other unknown error: don't leak error details
            logger.error('ERROR 💥', err);
            responseBody = {
                status: 'error',
                message: 'Something went wrong!'
            };
        }
    }

    // Convert to JSON string first to ensure proper content length
    const jsonResponse = JSON.stringify(responseBody);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(jsonResponse));
    res.status(err.statusCode).send(jsonResponse);
};

// Handle specific error types
const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(400, message);
};

const handleDuplicateFieldsDB = err => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(400, message);
};

const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(400, message);
};

const handleJWTError = () => 
    new AppError(401, 'Invalid token. Please log in again!');

const handleJWTExpiredError = () => 
    new AppError(401, 'Your token has expired! Please log in again.');

const notFound = (req, res, next) => {
    const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
    next(error);
};

// Export error handling utilities
module.exports = {
    AppError,
    errorHandler,
    handleCastErrorDB,
    handleDuplicateFieldsDB,
    handleValidationErrorDB,
    handleJWTError,
    handleJWTExpiredError,
    notFound
};

