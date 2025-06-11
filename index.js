/**
 * Entry point for the Nesa ERP Backend Application
 * Handles database connection, server initialization, and process management
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const monitoring = require('./utils/monitoring');
const setupCronJobs = require('./utils/cronJobs');
const { app, server, notificationServer } = require('./app');

/**
 * MongoDB Connection Setup
 * - Connects to MongoDB using environment variables
 * - Configures connection options based on environment
 * - Initializes monitoring metrics
 */
mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: process.env.NODE_ENV === 'development',
    // Additional MongoDB options can be added here
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

/**
 * Database Error Monitoring
 * Logs and tracks any database operation errors
 */
mongoose.connection.on('error', (error) => {
    logger.error('MongoDB error:', error);
    monitoring.incrementError('mongodb_error');
});

// Initialize scheduled tasks
setupCronJobs();

/**
 * Process Error Handlers
 * Handles uncaught exceptions and unhandled promise rejections
 * Ensures graceful shutdown in case of errors
 */
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    monitoring.incrementError('uncaught_exception');
    // Close server & exit process
    server.close(() => process.exit(1));
});

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
    monitoring.incrementError('unhandled_rejection');
    // Close server & exit process
    server.close(() => process.exit(1));
});

/**
 * Graceful Shutdown Handler
 * Properly closes database connections and server
 * on SIGTERM signal
 */
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
