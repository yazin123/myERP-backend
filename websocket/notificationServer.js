const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../utils/logger');

class NotificationServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ noServer: true });
        this.clients = new Map(); // Map to store client connections

        // Handle WebSocket connection
        this.wss.on('connection', (ws, request) => {
            const userId = request.userId;
            logger.info(`WebSocket connection established for user: ${userId}`);

            // Store the connection
            if (!this.clients.has(userId)) {
                this.clients.set(userId, new Set());
            }
            this.clients.get(userId).add(ws);

            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    logger.info(`Received message from user ${userId}:`, data);
                    // Handle different message types here
                } catch (error) {
                    logger.error('Error processing WebSocket message:', error);
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                logger.info(`WebSocket connection closed for user: ${userId}`);
                this.clients.get(userId).delete(ws);
                if (this.clients.get(userId).size === 0) {
                    this.clients.delete(userId);
                }
            });

            // Send initial connection success message
            ws.send(JSON.stringify({
                type: 'connection',
                status: 'success',
                message: 'Connected to notification server'
            }));
        });
    }

    // Method to handle upgrade requests
    handleUpgrade(request, socket, head) {
        const { query } = url.parse(request.url, true);
        
        if (!query.token) {
            socket.destroy();
            return;
        }

        // Verify JWT token
        try {
            const decoded = jwt.verify(query.token, process.env.JWT_SECRET);
            request.userId = decoded.userId;
            
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        } catch (error) {
            logger.error('WebSocket authentication failed:', error);
            socket.destroy();
        }
    }

    // Method to send notification to specific user
    sendNotification(userId, notification) {
        if (this.clients.has(userId)) {
            const userClients = this.clients.get(userId);
            userClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'notification',
                        data: notification
                    }));
                }
            });
        }
    }

    // Method to broadcast notification to all connected clients
    broadcast(notification) {
        this.clients.forEach((userClients, userId) => {
            userClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'broadcast',
                        data: notification
                    }));
                }
            });
        });
    }

    // Method to get connected clients count
    getConnectedClientsCount() {
        let count = 0;
        this.clients.forEach(userClients => {
            count += userClients.size;
        });
        return count;
    }
}

module.exports = NotificationServer; 