const prometheus = require('prom-client');
const logger = require('./logger');

// Create a Registry to register metrics
const register = new prometheus.Registry();

// Add default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

const activeUsers = new prometheus.Gauge({
    name: 'active_users',
    help: 'Number of currently active users'
});

const totalProjects = new prometheus.Gauge({
    name: 'total_projects',
    help: 'Total number of projects'
});

const taskCompletionRate = new prometheus.Gauge({
    name: 'task_completion_rate',
    help: 'Task completion rate per project',
    labelNames: ['project_id']
});

const errorRate = new prometheus.Counter({
    name: 'error_rate',
    help: 'Number of errors occurred',
    labelNames: ['error_type']
});

const databaseOperations = new prometheus.Counter({
    name: 'database_operations_total',
    help: 'Number of database operations',
    labelNames: ['operation', 'model']
});

const emailQueueSize = new prometheus.Gauge({
    name: 'email_queue_size',
    help: 'Current size of email queue'
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(activeUsers);
register.registerMetric(totalProjects);
register.registerMetric(taskCompletionRate);
register.registerMetric(errorRate);
register.registerMetric(databaseOperations);
register.registerMetric(emailQueueSize);

// Monitoring middleware
const monitorRequest = (req, res, next) => {
    const start = Date.now();
    
    // Record response
    res.on('finish', () => {
        const duration = Date.now() - start;
        httpRequestDurationMicroseconds
            .labels(req.method, req.route?.path || req.path, res.statusCode)
            .observe(duration / 1000); // Convert to seconds
    });
    
    next();
};

// Update metrics functions
const updateActiveUsers = (count) => {
    activeUsers.set(count);
};

const updateTotalProjects = (count) => {
    totalProjects.set(count);
};

const updateTaskCompletionRate = (projectId, rate) => {
    taskCompletionRate.labels(projectId).set(rate);
};

const incrementError = (errorType) => {
    errorRate.labels(errorType).inc();
};

const incrementDbOperation = (operation, model) => {
    databaseOperations.labels(operation, model).inc();
};

const updateEmailQueueSize = (size) => {
    emailQueueSize.set(size);
};

// System health check
const getSystemHealth = async () => {
    try {
        const metrics = await register.getMetricsAsJSON();
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            metrics: {
                activeUsers: metrics.find(m => m.name === 'active_users')?.values[0]?.value,
                errorRate: metrics.find(m => m.name === 'error_rate')?.values[0]?.value,
                emailQueueSize: metrics.find(m => m.name === 'email_queue_size')?.values[0]?.value,
                systemMemory: process.memoryUsage(),
                uptime: process.uptime()
            }
        };
        return health;
    } catch (error) {
        logger.error('Error getting system health:', error);
        throw error;
    }
};

module.exports = {
    register,
    monitorRequest,
    updateActiveUsers,
    updateTotalProjects,
    updateTaskCompletionRate,
    incrementError,
    incrementDbOperation,
    updateEmailQueueSize,
    getSystemHealth
}; 