const Redis = require('ioredis');
const logger = require('../utils/logger');

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL);

// Default cache duration (in seconds)
const DEFAULT_DURATION = 3600; // 1 hour

// Generate cache key from request
const generateCacheKey = (req) => {
    const { originalUrl, method, body, query } = req;
    return `${method}:${originalUrl}:${JSON.stringify(query)}:${JSON.stringify(body)}`;
};

// Cache middleware
const cache = (duration = DEFAULT_DURATION) => {
    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== 'GET') {
            return next();
        }

        try {
            const key = generateCacheKey(req);
            
            // Try to get cached response
            const cachedResponse = await redis.get(key);
            
            if (cachedResponse) {
                logger.debug(`Cache hit for key: ${key}`);
                return res.json(JSON.parse(cachedResponse));
            }

            // Store original send function
            const originalSend = res.json;

            // Override send function to cache response
            res.json = function(body) {
                // Cache the response
                redis.setex(key, duration, JSON.stringify(body))
                    .catch(err => logger.error('Cache set error:', err));

                // Call original send
                return originalSend.call(this, body);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error:', error);
            next();
        }
    };
};

// Clear cache for specific patterns
const clearCache = async (pattern) => {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(keys);
            logger.info(`Cleared cache for pattern: ${pattern}`);
        }
    } catch (error) {
        logger.error('Clear cache error:', error);
    }
};

// Clear cache middleware (for write operations)
const clearCacheByPattern = (pattern) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.json;

        // Override send function to clear cache after successful response
        res.json = function(body) {
            // Clear cache if response is successful
            if (res.statusCode >= 200 && res.statusCode < 300) {
                clearCache(pattern)
                    .catch(err => logger.error('Clear cache error:', err));
            }

            // Call original send
            return originalSend.call(this, body);
        };

        next();
    };
};

module.exports = {
    cache,
    clearCache,
    clearCacheByPattern
}; 