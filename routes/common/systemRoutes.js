const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const systemController = require('../../controllers/common/systemController');

// Get basic system status (uptime, version, etc.)
router.get('/status', authenticate, systemController.getBasicStatus);

module.exports = router; 