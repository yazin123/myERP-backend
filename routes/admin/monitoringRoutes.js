const express = require('express');
const router = express.Router();
const { authenticate, adminAuth } = require('../../middleware/auth');
const monitoring = require('../../utils/monitoring');
const emailService = require('../../utils/emailService');
const logger = require('../../utils/logger');

// Get Prometheus metrics
router.get('/metrics', authenticate, adminAuth, async (req, res) => {
    try {
        res.set('Content-Type', monitoring.register.contentType);
        const metrics = await monitoring.register.metrics();
        res.send(metrics);
    } catch (error) {
        logger.error('Error fetching metrics:', error);
        res.status(500).json({ error: 'Error fetching metrics' });
    }
});

// Get system health
router.get('/health', authenticate, adminAuth, async (req, res) => {
    try {
        const health = await monitoring.getSystemHealth();
        res.json(health);
    } catch (error) {
        logger.error('Error fetching system health:', error);
        res.status(500).json({ error: 'Error fetching system health' });
    }
});

// Get email queue status
router.get('/email-queue', authenticate, adminAuth, async (req, res) => {
    try {
        const queue = emailService.emailQueue;
        const status = {
            waiting: await queue.getWaitingCount(),
            active: await queue.getActiveCount(),
            completed: await queue.getCompletedCount(),
            failed: await queue.getFailedCount(),
            delayed: await queue.getDelayedCount()
        };
        res.json(status);
    } catch (error) {
        logger.error('Error fetching email queue status:', error);
        res.status(500).json({ error: 'Error fetching email queue status' });
    }
});

// Clear failed jobs from email queue
router.post('/email-queue/clear-failed', authenticate, adminAuth, async (req, res) => {
    try {
        await emailService.emailQueue.clean(0, 'failed');
        res.json({ message: 'Failed jobs cleared successfully' });
    } catch (error) {
        logger.error('Error clearing failed jobs:', error);
        res.status(500).json({ error: 'Error clearing failed jobs' });
    }
});

// Get detailed system metrics
router.get('/detailed-metrics', authenticate, adminAuth, async (req, res) => {
    try {
        const metrics = {
            system: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptime: process.uptime(),
                nodeVersion: process.version
            },
            custom: await monitoring.register.getMetricsAsJSON()
        };
        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching detailed metrics:', error);
        res.status(500).json({ error: 'Error fetching detailed metrics' });
    }
});

module.exports = router; 