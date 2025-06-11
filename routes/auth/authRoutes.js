const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const authController = require('../../controllers/auth/authController');
const { validateLogin, validateRegister, validatePasswordReset } = require('../../middleware/validation');

// Authentication routes
router.post('/login', validateLogin, authController.login);
router.post('/register', validateRegister, authController.register);
router.post('/logout', authenticate, authController.logout);

// Password management
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', validatePasswordReset, authController.resetPassword);
router.post('/change-password', authenticate, validatePasswordReset, authController.changePassword);

// Token management
router.post('/refresh-token', authController.refreshToken);
router.post('/verify-token', authController.verifyToken);

// Account verification
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Session management
router.get('/sessions', authenticate, authController.getUserSessions);
router.delete('/sessions/:sessionId', authenticate, authController.terminateSession);
router.delete('/sessions', authenticate, authController.terminateAllSessions);

// Account management
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/me', authenticate, authController.updateProfile);
router.delete('/me', authenticate, authController.deactivateAccount);

// Two-factor authentication
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);
router.post('/2fa/generate-backup-codes', authenticate, authController.generateBackupCodes);

module.exports = router; 