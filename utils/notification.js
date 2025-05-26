const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

class NotificationService {
    constructor() {
        this.clients = new Map(); // userId -> WebSocket
        this.server = null;
    }

    initialize(server) {
        this.server = new WebSocket.Server({ server });

        this.server.on('connection', async (ws, req) => {
            try {
                // Get token from query string
                const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
                if (!token) {
                    throw new AppError('No authentication token provided', 401);
                }

                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                
                if (!user) {
                    throw new AppError('User not found', 404);
                }

                // Store client connection
                this.clients.set(user._id.toString(), ws);
                logger.info(`Client connected: ${user._id}`);

                // Handle client messages
                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message);
                        logger.debug(`Received message from ${user._id}:`, data);
                    } catch (error) {
                        logger.error('Error processing message:', error);
                    }
                });

                // Handle client disconnection
                ws.on('close', () => {
                    this.clients.delete(user._id.toString());
                    logger.info(`Client disconnected: ${user._id}`);
                });

                // Send initial connection success message
                this.sendToUser(user._id, {
                    type: 'connection',
                    message: 'Successfully connected to notification service'
                });

            } catch (error) {
                logger.error('WebSocket connection error:', error);
                ws.close();
            }
        });

        // Handle server errors
        this.server.on('error', (error) => {
            logger.error('WebSocket server error:', error);
        });
    }

    // Send notification to specific user
    async sendToUser(userId, notification) {
        try {
            const ws = this.clients.get(userId.toString());
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    ...notification,
                    timestamp: new Date()
                }));
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error sending notification to user ${userId}:`, error);
            return false;
        }
    }

    // Send notification to multiple users
    async sendToUsers(userIds, notification) {
        const results = await Promise.all(
            userIds.map(userId => this.sendToUser(userId, notification))
        );
        return results.filter(Boolean).length;
    }

    // Send notification to all connected clients
    async broadcast(notification, excludeUserId = null) {
        let sentCount = 0;
        for (const [userId, ws] of this.clients.entries()) {
            if (excludeUserId && userId === excludeUserId.toString()) {
                continue;
            }
            if (await this.sendToUser(userId, notification)) {
                sentCount++;
            }
        }
        return sentCount;
    }

    // Create and send project notification
    async createProjectNotification(data) {
        try {
            const { type, projectId, message, userIds = [] } = data;
            
            const notification = {
                type: `project_${type}`,
                projectId,
                message,
                timestamp: new Date()
            };

            // Send to specific users if provided, otherwise broadcast
            if (userIds.length > 0) {
                return await this.sendToUsers(userIds, notification);
            } else {
                return await this.broadcast(notification);
            }
        } catch (error) {
            logger.error('Error creating project notification:', error);
            return 0;
        }
    }

    // Create and send task notification
    async createTaskNotification(data) {
        try {
            const { type, taskId, projectId, message, userIds = [] } = data;
            
            const notification = {
                type: `task_${type}`,
                taskId,
                projectId,
                message,
                timestamp: new Date()
            };

            return await this.sendToUsers(userIds, notification);
        } catch (error) {
            logger.error('Error creating task notification:', error);
            return 0;
        }
    }

    // Create and send user notification
    async createUserNotification(data) {
        try {
            const { type, userId, message } = data;
            
            const notification = {
                type: `user_${type}`,
                message,
                timestamp: new Date()
            };

            return await this.sendToUser(userId, notification);
        } catch (error) {
            logger.error('Error creating user notification:', error);
            return false;
        }
    }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService; 