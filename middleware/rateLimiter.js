const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis client
const redisClient = new Redis(process.env.REDIS_URL);

// Handle Redis errors
redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
});

// Base rate limiter configuration
const createRateLimiter = (options) => rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rl:', // Redis key prefix for rate limiter
        ...options.redis
    }),
    windowMs: options.windowMs || 60 * 60 * 1000, // default 1 hour
    max: options.max || 100, // default 100 requests per windowMs
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Different rate limiters for different routes
const rateLimiters = {
    // Authentication routes (login, register, etc.)
    auth: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per 15 minutes
        message: 'Too many authentication attempts, please try again after 15 minutes.'
    }),

    // API routes
    api: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 1000 // 1000 requests per hour
    }),

    // Admin routes
    admin: createRateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 500 // 500 requests per hour
    }),

    // Public routes
    public: createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // 100 requests per 15 minutes
    })
};

// Middleware to apply rate limiting based on user role
const dynamicRateLimit = (req, res, next) => {
    const userRole = req.user?.role || 'public';
    const limiter = rateLimiters[userRole] || rateLimiters.public;
    return limiter(req, res, next);
};

module.exports = {
    rateLimiters,
    dynamicRateLimit
}; 