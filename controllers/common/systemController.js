const os = require('os');
const logger = require('../../utils/logger');
const pkg = require('../../package.json');

const systemController = {
    // Get basic system status
    getBasicStatus: async (req, res) => {
        try {
            const status = {
                version: pkg.version,
                uptime: process.uptime(),
                timestamp: Date.now(),
                nodeVersion: process.version,
                memory: {
                    total: os.totalmem(),
                    free: os.freemem(),
                    used: os.totalmem() - os.freemem()
                },
                cpu: {
                    cores: os.cpus().length,
                    model: os.cpus()[0].model,
                    speed: os.cpus()[0].speed
                },
                platform: {
                    type: os.type(),
                    platform: os.platform(),
                    arch: os.arch(),
                    release: os.release()
                }
            };

            res.json(status);
        } catch (error) {
            logger.error('Get system status error:', error);
            res.status(500).json({ message: 'Failed to fetch system status' });
        }
    }
};

module.exports = systemController; 