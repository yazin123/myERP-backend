const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
    // Start timer
    const start = Date.now();

    // Log request
    logger.info({
        type: 'request',
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined,
        user: req.user ? req.user._id : 'anonymous',
        ip: req.ip
    });

    // Log response
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            type: 'response',
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            user: req.user ? req.user._id : 'anonymous'
        });
    });

    next();
};

module.exports = requestLogger; 