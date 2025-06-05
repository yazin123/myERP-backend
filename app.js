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

const app = express();

// Security middleware
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

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'Authorization']
}));

// Request parsing and sanitization
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(expressSanitizer());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Compression
app.use(compression());

// Monitoring middleware
app.use(monitoring.monitorRequest);

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev', { stream: logger.stream }));
} else {
    app.use(morgan('combined', { stream: logger.stream }));
}

// Timeout
app.use(timeout('30s'));
app.use((req, res, next) => {
    if (!req.timedout) next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Nesa ERP API Documentation'
}));

// Import routes
const routes = {
    common: {
        timeline: require('./routes/common/timelineEventRoutes'),
        tasks: require('./routes/common/taskRoutes'),
        users: require('./routes/common/userRoutes'),
        projects: require('./routes/common/projectRoutes'),
        notifications: require('./routes/common/notificationRoutes'),
        system: require('./routes/common/systemRoutes'),
        dashboard: require('./routes/common/dashboardRoutes'),
        dailyReports: require('./routes/common/dailyReportRoutes'),
        projectTasks: require('./routes/common/projectTaskRoutes')
    },
    admin: {
        users: require('./routes/admin/userRoutes'),
        projects: require('./routes/admin/projectRoutes'),
        tasks: require('./routes/admin/taskRoutes'),
        monitoring: require('./routes/admin/monitoringRoutes'),
        performance: require('./routes/admin/performanceRoutes'),
        rbac: require('./routes/admin/rbacRoutes'),
        dashboard: require('./routes/admin/dashboardRoutes')
    }
};

// Apply rate limiting to all API routes
app.use('/api', dynamicRateLimit);

// Mount API routes - v1
const API_V1_PREFIX = '/api/v1';

// Common routes
app.use(`${API_V1_PREFIX}/timeline`, routes.common.timeline);
app.use(`${API_V1_PREFIX}/tasks`, routes.common.tasks);
app.use(`${API_V1_PREFIX}/users`, routes.common.users);
app.use(`${API_V1_PREFIX}/projects`, routes.common.projects);
app.use(`${API_V1_PREFIX}/notifications`, routes.common.notifications);
app.use(`${API_V1_PREFIX}/system`, routes.common.system);
app.use(`${API_V1_PREFIX}/dashboard`, routes.common.dashboard);
app.use(`${API_V1_PREFIX}/daily-reports`, routes.common.dailyReports);
app.use(`${API_V1_PREFIX}/project-tasks`, routes.common.projectTasks);

// Admin routes
app.use(`${API_V1_PREFIX}/admin/users`, routes.admin.users);
app.use(`${API_V1_PREFIX}/admin/projects`, routes.admin.projects);
app.use(`${API_V1_PREFIX}/admin/tasks`, routes.admin.tasks);
app.use(`${API_V1_PREFIX}/admin/monitoring`, routes.admin.monitoring);
app.use(`${API_V1_PREFIX}/admin/performance`, routes.admin.performance);
app.use(`${API_V1_PREFIX}/admin/dashboard`, routes.admin.dashboard);
app.use(`${API_V1_PREFIX}/admin`, routes.admin.rbac);

// Health check endpoint
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
app.use((req, res, next) => {
    next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Error handling
app.use(errorHandler);

// Create HTTP server
const server = require('http').createServer(app);

// Initialize WebSocket server
const notificationServer = new NotificationServer();

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith('/notifications')) {
        notificationServer.handleUpgrade(request, socket, head);
    } else {
        socket.destroy();
    }
});

// Export both app and notification server
module.exports = {
    app,
    server,
    notificationServer
}; 