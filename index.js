const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const expressSanitizer = require('express-sanitizer');
const morgan = require('morgan');
const timeout = require('connect-timeout');
const { apiLimiter } = require('./middleware/auth');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const setupCronJobs = require('./utils/cronJobs');

const AdminuserRoutes = require('./routes/admin/userRoutes');
const AdmintaskRoutes = require('./routes/admin/taskRoutes');
const AdminperformanceRoutes = require('./routes/admin/performanceRoutes');
const AdminleadRoutes = require('./routes/admin/leadRoutes');
const AdminprojectRoutes = require('./routes/admin/projectRoutes')

require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            upgradeInsecureRequests: null
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: ['http://localhost:3000', 'https://my-erp-frontend.vercel.app/'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    exposedHeaders: ['Content-Length', 'Authorization']
}));

app.use(expressSanitizer());
app.use(apiLimiter);

// Performance middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(timeout('30s'));

// Logging
app.use(morgan('combined', { stream: logger.stream }));

// Database connection
const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger.info('Connected to MongoDB');
    } catch (err) {
        if (retries === 0) {
            logger.error('MongoDB connection failed:', err);
            process.exit(1);
        }
        logger.warn(`Retrying connection... (${retries} attempts left)`);
        setTimeout(() => connectDB(retries - 1), 5000);
    }
};

connectDB();

// Initialize cron jobs
setupCronJobs();

// Routes for admin
app.use('/api/admin/users', AdminuserRoutes);
app.use ('/api/admin/projects',AdminprojectRoutes);
app.use('/api/admin/tasks', AdmintaskRoutes);
app.use('/api/admin/performance', AdminperformanceRoutes);
app.use('/api/admin/leads', AdminleadRoutes);

// Health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Base route
app.get("/", (req, res) => {
    res.send("Welcome to the Yazins ERP");
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Handle timeouts
app.use((req, res, next) => {
    if (!req.timedout) next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    process.exit(1);
});

module.exports = app;
