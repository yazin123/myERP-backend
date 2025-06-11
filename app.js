/**
 * Main application file for the Nesa ERP Backend
 * Sets up Express server with all middleware and route configurations
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const expressSanitizer = require('express-sanitizer');
const morgan = require('morgan');
const timeout = require('connect-timeout');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { dynamicRateLimit } = require('./middleware/rateLimiter');
const swaggerSpec = require('./utils/swagger');
const monitoring = require('./utils/monitoring');
const mongoose = require('mongoose');
const { ApiError } = require('./utils/errors');
const NotificationServer = require('./websocket/notificationServer');
const { authenticate } = require('./middleware/auth');

// Initialize express app
const app = express();

/**
 * Security Middleware Configuration
 * - Helmet: Secure HTTP headers
 * - CORS: Cross-Origin Resource Sharing
 * - Express Sanitizer: Prevent XSS
 * - Mongo Sanitize: Prevent NoSQL Injection
 * - HPP: HTTP Parameter Pollution
 */
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            connectSrc: ["'self'", ...(process.env.ALLOWED_ORIGINS?.split(',') || [])],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'Authorization']
}));

/**
 * Request Parsing and Protection Middleware
 * - JSON body parser with size limit
 * - URL-encoded parser
 * - Sanitization middleware
 */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(expressSanitizer());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

/**
 * Performance Middleware
 * - Compression: Compress response bodies
 * - Morgan: HTTP request logging
 * - Timeout: Request timeout handling
 */
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined', { stream: logger.stream }));
app.use(timeout('30s'));
app.use((req, res, next) => {
    if (!req.timedout) next();
});

// Import route modules
const authRoutes = require('./routes/auth/authRoutes');
const adminRoutes = require('./routes/admin');
const commonRoutes = require('./routes/common');
const v1Routes = require('./routes/v1');

// Apply rate limiting to all API routes
app.use('/api', dynamicRateLimit);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api', commonRoutes);
app.use('/api/v1', v1Routes);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Nesa ERP API Documentation'
}));

/**
 * Health Check Endpoint
 * Used for monitoring system health and uptime
 */
app.get('/health', async (req, res) => {
    try {
        const health = await monitoring.getSystemHealth();
        res.status(200).json(health);
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error checking system health'
        });
    }
});

// Base route
app.get('/', (req, res) => {
    res.send('Welcome to the Nesa ERP API');
});

// 404 handler
app.use(notFound);

// Error handling
app.use(errorHandler);

// Create HTTP server
const server = require('http').createServer(app);

// Initialize WebSocket server
const notificationServer = new NotificationServer();

/**
 * WebSocket upgrade handler
 * Only allows upgrades for notification endpoints
 */
server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith('/notifications')) {
        notificationServer.handleUpgrade(request, socket, head);
    } else {
        socket.destroy();
    }
});

module.exports = {
    app,
    server,
    notificationServer
}; 