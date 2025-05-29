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
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { dynamicRateLimit } = require('./middleware/rateLimiter');
const swaggerSpec = require('./utils/swagger');

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

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'Nesa ERP API Documentation'
}));

// Import routes
const timelineEventRoutes = require('./routes/timelineEventRoutes');
const taskRoutes = require('./routes/taskRoutes');
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminProjectRoutes = require('./routes/admin/projectRoutes');
const adminTaskRoutes = require('./routes/admin/taskRoutes');
const adminMonitoringRoutes = require('./routes/admin/monitoringRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const adminPerformanceRoutes = require('./routes/admin/performanceRoutes');
const commonUserRoutes = require('./routes/common/userRoutes');
const commonTaskRoutes = require('./routes/common/taskRoutes');
const commonProjectRoutes = require('./routes/common/projectRoutes');
const commonNotificationRoutes = require('./routes/common/notificationRoutes');
const commonSystemRoutes = require('./routes/common/systemRoutes');
const commonDashboardRoutes = require('./routes/common/dashboardRoutes');
const dailyReportRoutes = require('./routes/common/dailyReportRoutes');
const projectTaskRoutes = require('./routes/common/projectTaskRoutes');

// Apply rate limiting to all API routes
app.use('/api', dynamicRateLimit);

// Mount routes
app.use('/api/timeline', timelineEventRoutes);
app.use('/api/tasks', taskRoutes);

// Common routes
app.use('/api/users', commonUserRoutes);
app.use('/api/tasks', commonTaskRoutes);
app.use('/api/projects', commonProjectRoutes);
app.use('/api/notifications', commonNotificationRoutes);
app.use('/api/system', commonSystemRoutes);
app.use('/api/dashboard', commonDashboardRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api', projectTaskRoutes);

// Admin routes
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/projects', adminProjectRoutes);
app.use('/api/admin/tasks', adminTaskRoutes);
app.use('/api/admin/monitoring', adminMonitoringRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/performance', adminPerformanceRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app; 