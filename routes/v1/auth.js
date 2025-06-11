const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const authController = require('../../controllers/auth/authController');
const { validateLogin, validateRegister, validatePasswordReset, validateProfileUpdate } = require('../../middleware/validation');
const upload = require('../../middleware/fileUpload');

/**
 * Authentication Routes
 * @route /api/v1/auth
 */

// Authentication
router.post('/login', validateLogin, authController.login);
router.post('/register', validateRegister, authController.register);
router.post('/logout', authenticate, authController.logout);

// Password Management
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', validatePasswordReset, authController.resetPassword);
router.post('/change-password', authenticate, validatePasswordReset, authController.changePassword);

// Token Management
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-token', authController.verifyToken);

// Profile Management
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/me', authenticate, validateProfileUpdate, authController.updateProfile);
router.put('/me/photo', authenticate, upload.single('photo'), authController.updateProfilePhoto);

// Account Verification
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Session Management
router.get('/sessions', authenticate, authController.getUserSessions);
router.delete('/sessions/:sessionId', authenticate, authController.terminateSession);
router.delete('/sessions', authenticate, authController.terminateAllSessions);

// Two-Factor Authentication
router.post('/2fa/enable', authenticate, authController.enable2FA);
router.post('/2fa/verify', authenticate, authController.verify2FA);
router.post('/2fa/disable', authenticate, authController.disable2FA);
router.post('/2fa/backup-codes', authenticate, authController.generateBackupCodes);

module.exports = router; 