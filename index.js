require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const monitoring = require('./utils/monitoring');
const setupCronJobs = require('./utils/cronJobs');
const { app, server, notificationServer } = require('./app');

// Database connection with monitoring
mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: process.env.NODE_ENV === 'development'
})
.then(() => {
    logger.info('Connected to MongoDB');
    monitoring.updateActiveUsers(0); // Initialize active users metric

    // Start the server after successful database connection
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
        logger.info('WebSocket notification server initialized');
    });
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
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
    monitoring.incrementError('unhandled_rejection');
    // Close server & exit process
    server.close(() => process.exit(1));
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

module.exports = server;
