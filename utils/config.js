const logger = require('./logger');

const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'NODE_ENV',
    'PORT',
    'REDIS_URL',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_FROM'
];

const optionalEnvVars = [
    'ALLOWED_ORIGINS',
    'SENTRY_DSN',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_BUCKET_NAME'
];

function validateConfig() {
    const missingVars = [];
    
    // Check required variables
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    });

    if (missingVars.length > 0) {
        const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    // Validate specific formats
    if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb')) {
        throw new Error('Invalid MONGODB_URI format');
    }

    if (process.env.PORT && isNaN(process.env.PORT)) {
        throw new Error('PORT must be a number');
    }

    if (process.env.EMAIL_PORT && isNaN(process.env.EMAIL_PORT)) {
        throw new Error('EMAIL_PORT must be a number');
    }

    // Log optional variables status
    optionalEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            logger.warn(`Optional environment variable ${varName} is not set`);
        }
    });

    // Create config object with defaults
    const config = {
        mongodb: {
            uri: process.env.MONGODB_URI,
            options: {
                autoIndex: process.env.NODE_ENV === 'development'
            }
        },
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN
        },
        server: {
            port: parseInt(process.env.PORT, 10) || 5000,
            env: process.env.NODE_ENV,
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
        },
        redis: {
            url: process.env.REDIS_URL
        },
        email: {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10),
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
            from: process.env.EMAIL_FROM
        },
        aws: process.env.AWS_ACCESS_KEY_ID ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
            bucketName: process.env.AWS_BUCKET_NAME
        } : null,
        sentry: {
            dsn: process.env.SENTRY_DSN
        }
    };

    return config;
}

module.exports = validateConfig(); 