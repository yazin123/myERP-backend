const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const { AppError } = require('./errorHandler');

// Create Redis client
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false
});

// General API rate limiter
const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rl:api:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    handler: (req, res) => {
        throw new AppError(429, 'Too many requests from this IP, please try again later.');
    }
});

// Authentication rate limiter (more strict)
const authLimiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rl:auth:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many login attempts from this IP, please try again after an hour.',
    handler: (req, res) => {
        throw new AppError(429, 'Too many login attempts from this IP, please try again after an hour.');
    }
});

// File upload rate limiter
const uploadLimiter = rateLimit({
    store: new RedisStore({
        client: redisClient,
        prefix: 'rl:upload:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Limit each IP to 50 uploads per windowMs
    message: 'Too many file uploads from this IP, please try again later.',
    handler: (req, res) => {
        throw new AppError(429, 'Too many file uploads from this IP, please try again later.');
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    uploadLimiter,
    redisClient
}; 