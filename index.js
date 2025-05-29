const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const expressSanitizer = require('express-sanitizer');
const morgan = require('morgan');
const timeout = require('connect-timeout');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const { apiLimiter } = require('./middleware/auth');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { notificationService } = require('./utils/notification');
const monitoring = require('./utils/monitoring');
const emailService = require('./utils/emailService');

const setupCronJobs = require('./utils/cronJobs');

// Import admin routes
const adminUserRoutes = require('./routes/admin/userRoutes');
const adminProjectRoutes = require('./routes/admin/projectRoutes');
const adminTaskRoutes = require('./routes/admin/taskRoutes');
const adminMonitoringRoutes = require('./routes/admin/monitoringRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardRoutes');
const adminPerformanceRoutes = require('./routes/admin/performanceRoutes');

// Import common routes
const commonUserRoutes = require('./routes/common/userRoutes');
const commonTaskRoutes = require('./routes/common/taskRoutes');
const commonProjectRoutes = require('./routes/common/projectRoutes');
const commonNotificationRoutes = require('./routes/common/notificationRoutes');
const commonSystemRoutes = require('./routes/common/systemRoutes');
const commonDashboardRoutes = require('./routes/common/dashboardRoutes');
const dailyReportRoutes = require('./routes/common/dailyReportRoutes');
const projectTaskRoutes = require('./routes/common/projectTaskRoutes');

require('dotenv').config();

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

// Rate limiting
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Common routes (available to all authenticated users)
app.use('/api/users', commonUserRoutes);
app.use('/api/tasks', commonTaskRoutes);
app.use('/api/projects', commonProjectRoutes);
app.use('/api/notifications', commonNotificationRoutes);
app.use('/api/system', commonSystemRoutes);
app.use('/api/dashboard', commonDashboardRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api', projectTaskRoutes);

// Admin routes (protected by admin middleware)
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/projects', adminProjectRoutes);
app.use('/api/admin/tasks', adminTaskRoutes);
app.use('/api/admin/monitoring', adminMonitoringRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/performance', adminPerformanceRoutes);

// Health check with detailed metrics
app.get("/health", async (req, res) => {
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
app.get("/", (req, res) => {
    res.send("Welcome to the Yazins ERP");
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Database connection with monitoring
mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: process.env.NODE_ENV === 'development'
})
.then(() => {
    logger.info('Connected to MongoDB');
    monitoring.updateActiveUsers(0); // Initialize active users metric
})
.catch((error) => {
    logger.error('MongoDB connection error:', error);
    monitoring.incrementError('mongodb_connection');
    process.exit(1);
});

// Monitor database operations
mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error:', error);
    monitoring.incrementError('mongodb_error');
});

// Initialize cron jobs
setupCronJobs();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    monitoring.incrementError('uncaught_exception');
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed.');
            process.exit(0);
        });
    });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Initialize WebSocket server for notifications
notificationService.initialize(server);

module.exports = app;
