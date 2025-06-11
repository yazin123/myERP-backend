const User = require('../../models/User');
const Session = require('../../models/Session');
const Token = require('../../models/Token');
const { generateToken, verifyToken } = require('../../utils/jwt');
const { hashPassword, comparePassword } = require('../../utils/password');
const { sendEmail } = require('../../utils/email');
const { generate2FASecret, verify2FAToken, generateBackupCodes } = require('../../utils/twoFactor');
const logger = require('../../utils/logger');
const { ApiError } = require('../../utils/errors');
const { successResponse, errorResponse } = require('../../utils/responseHandler');

/**
 * Authentication Controller
 * Handles all authentication and user management related operations
 */
const authController = {
    // Authentication
    async login(req, res) {
        try {
            const { email, password, remember = false } = req.body;

            // Find user
            const user = await User.findOne({ email }).select('+password +twoFactorSecret');
            if (!user || !(await comparePassword(password, user.password))) {
                throw new ApiError(401, 'Invalid credentials');
            }

            // Check if account is active
            if (!user.isActive) {
                throw new ApiError(403, 'Account is deactivated');
            }

            // Check if email is verified
            if (!user.isEmailVerified) {
                throw new ApiError(403, 'Please verify your email first');
            }

            // Create session
            const session = await Session.create({
                user: user._id,
                userAgent: req.headers['user-agent'],
                ip: req.ip
            });

            // Generate tokens
            const accessToken = generateToken(
                { userId: user._id, sessionId: session._id },
                '15m'
            );
            const refreshToken = generateToken(
                { userId: user._id, sessionId: session._id, tokenVersion: user.tokenVersion },
                remember ? '30d' : '7d'
            );

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            res.json({
                success: true,
                data: {
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        requires2FA: !!user.twoFactorSecret
                    },
                    tokens: { accessToken, refreshToken }
                }
            });
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    },

    async register(req, res) {
        try {
            const { name, email, password } = req.body;

            // Check if user exists
            if (await User.findOne({ email })) {
                throw new ApiError(400, 'Email already registered');
            }

            // Create user
            const user = await User.create({
                name,
                email,
                password: await hashPassword(password),
                isEmailVerified: false
            });

            // Generate verification token
            const verificationToken = generateToken({ userId: user._id }, '24h');

            // Send verification email
            await sendEmail({
                to: email,
                subject: 'Verify your email',
                template: 'emailVerification',
                context: {
                    name,
                    verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
                }
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful. Please check your email to verify your account.'
            });
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    },

    async logout(req, res) {
        try {
            // Delete session
            await Session.findByIdAndDelete(req.session._id);

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            logger.error('Logout error:', error);
            throw error;
        }
    },

    // Password Management
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const user = await User.findOne({ email });

            if (!user) {
                // Return success even if user not found for security
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, you will receive password reset instructions.'
                });
            }

            // Generate reset token
            const resetToken = generateToken({ userId: user._id }, '1h');

            // Save reset token
            await Token.create({
                user: user._id,
                token: resetToken,
                type: 'password_reset',
                expiresAt: new Date(Date.now() + 3600000) // 1 hour
            });

            // Send reset email
            await sendEmail({
                to: email,
                subject: 'Reset your password',
                template: 'passwordReset',
                context: {
                    name: user.name,
                    resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
                }
            });

            res.json({
                success: true,
                message: 'If an account exists with this email, you will receive password reset instructions.'
            });
        } catch (error) {
            logger.error('Forgot password error:', error);
            throw error;
        }
    },

    async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;

            // Verify token
            const decoded = verifyToken(token);
            if (!decoded) {
                throw new ApiError(400, 'Invalid or expired token');
            }

            // Find token in database
            const resetToken = await Token.findOne({
                user: decoded.userId,
                token,
                type: 'password_reset',
                used: false,
                expiresAt: { $gt: new Date() }
            });

            if (!resetToken) {
                throw new ApiError(400, 'Invalid or expired token');
            }

            // Update password
            const user = await User.findById(decoded.userId);
            user.password = await hashPassword(password);
            user.tokenVersion += 1; // Invalidate all existing sessions
            await user.save();

            // Mark token as used
            resetToken.used = true;
            await resetToken.save();

            // Invalidate all sessions
            await Session.deleteMany({ user: user._id });

            res.json({
                success: true,
                message: 'Password reset successful'
            });
        } catch (error) {
            logger.error('Reset password error:', error);
            throw error;
        }
    },

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = await User.findById(req.user._id).select('+password');

            // Verify current password
            if (!(await comparePassword(currentPassword, user.password))) {
                throw new ApiError(400, 'Current password is incorrect');
            }

            // Update password
            user.password = await hashPassword(newPassword);
            user.tokenVersion += 1; // Invalidate all existing sessions except current
            await user.save();

            // Invalidate all other sessions
            await Session.deleteMany({
                user: user._id,
                _id: { $ne: req.session._id }
            });

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            logger.error('Change password error:', error);
            throw error;
        }
    },

    // Token Management
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            // Verify refresh token
            const decoded = verifyToken(refreshToken);
            if (!decoded) {
                throw new ApiError(401, 'Invalid refresh token');
            }

            // Get user and session
            const [user, session] = await Promise.all([
                User.findById(decoded.userId),
                Session.findById(decoded.sessionId)
            ]);

            // Validate token version and session
            if (!user || !session || user.tokenVersion !== decoded.tokenVersion) {
                throw new ApiError(401, 'Invalid refresh token');
            }

            // Generate new access token
            const accessToken = generateToken(
                { userId: user._id, sessionId: session._id },
                '15m'
            );

            res.json({
                success: true,
                data: { accessToken }
            });
        } catch (error) {
            logger.error('Refresh token error:', error);
            throw error;
        }
    },

    // Account Management
    async getCurrentUser(req, res) {
        try {
            const user = await User.findById(req.user._id)
                .select('-password -twoFactorSecret -tokenVersion')
                .populate('department', 'name')
                .populate('designation', 'name');

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            logger.error('Get current user error:', error);
            throw error;
        }
    },

    async updateProfile(req, res) {
        try {
            const updates = req.body;
            const user = await User.findByIdAndUpdate(
                req.user._id,
                { $set: updates },
                { new: true, runValidators: true }
            );

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: user
            });
        } catch (error) {
            logger.error('Profile update error:', error);
            throw error;
        }
    },

    async updateProfilePhoto(req, res) {
        try {
            if (!req.file) {
                throw new ApiError(400, 'No photo uploaded');
            }

            const photoUrl = `/uploads/photos/${req.file.filename}`;
            const user = await User.findByIdAndUpdate(
                req.user._id,
                { $set: { photo: photoUrl } },
                { new: true }
            );

            return successResponse(res, { photoUrl: user.photo }, 'Profile photo updated successfully');
        } catch (error) {
            logger.error('Profile photo update error:', error);
            throw error;
        }
    },

    // Two-Factor Authentication
    async enable2FA(req, res) {
        try {
            const user = await User.findById(req.user._id);

            // Generate secret
            const { secret, qrCode } = await generate2FASecret(user.email);

            // Save secret temporarily
            user.tempTwoFactorSecret = secret;
            await user.save();

            res.json({
                success: true,
                data: { qrCode }
            });
        } catch (error) {
            logger.error('Enable 2FA error:', error);
            throw error;
        }
    },

    async verify2FA(req, res) {
        try {
            const { token } = req.body;
            const user = await User.findById(req.user._id).select('+tempTwoFactorSecret');

            // Verify token
            if (!verify2FAToken(token, user.tempTwoFactorSecret)) {
                throw new ApiError(400, 'Invalid verification code');
            }

            // Enable 2FA
            user.twoFactorSecret = user.tempTwoFactorSecret;
            user.tempTwoFactorSecret = undefined;
            await user.save();

            res.json({
                success: true,
                message: '2FA enabled successfully'
            });
        } catch (error) {
            logger.error('Verify 2FA error:', error);
            throw error;
        }
    },

    async disable2FA(req, res) {
        try {
            const { token } = req.body;
            const user = await User.findById(req.user._id).select('+twoFactorSecret');

            // Verify token
            if (!verify2FAToken(token, user.twoFactorSecret)) {
                throw new ApiError(400, 'Invalid verification code');
            }

            // Disable 2FA
            user.twoFactorSecret = undefined;
            await user.save();

            res.json({
                success: true,
                message: '2FA disabled successfully'
            });
        } catch (error) {
            logger.error('Disable 2FA error:', error);
            throw error;
        }
    },

    async generateBackupCodes(req, res) {
        try {
            const { token } = req.body;
            const user = await User.findById(req.user._id).select('+twoFactorSecret +backupCodes');

            // Verify token
            if (!verify2FAToken(token, user.twoFactorSecret)) {
                throw new ApiError(400, 'Invalid verification code');
            }

            // Generate new backup codes
            const backupCodes = await generateBackupCodes();
            user.backupCodes = backupCodes.map(code => ({
                code:  hashPassword(code),
                used: false
            }));
            await user.save();

            res.json({
                success: true,
                data: { backupCodes }
            });
        } catch (error) {
            logger.error('Generate backup codes error:', error);
            throw error;
        }
    },

    // Email Verification
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;

            // Verify token
            const decoded = verifyToken(token);
            if (!decoded) {
                throw new ApiError(400, 'Invalid or expired token');
            }

            // Find user
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            // Check if already verified
            if (user.isEmailVerified) {
                return res.json({
                    success: true,
                    message: 'Email already verified'
                });
            }

            // Update user
            user.isEmailVerified = true;
            await user.save();

            res.json({
                success: true,
                message: 'Email verified successfully'
            });
        } catch (error) {
            logger.error('Email verification error:', error);
            throw error;
        }
    },

    async resendVerificationEmail(req, res) {
        try {
            const { email } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return res.json({
                    success: true,
                    message: 'If an account exists with this email, you will receive a verification email.'
                });
            }

            // Check if already verified
            if (user.isEmailVerified) {
                return res.json({
                    success: true,
                    message: 'Email already verified'
                });
            }

            // Generate verification token
            const verificationToken = generateToken({ userId: user._id }, '24h');

            // Send verification email
            await sendEmail({
                to: email,
                subject: 'Verify your email',
                template: 'emailVerification',
                context: {
                    name: user.name,
                    verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
                }
            });

            res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a verification email.'
            });
        } catch (error) {
            logger.error('Resend verification email error:', error);
            throw error;
        }
    },

    // Token verification
    async verifyToken(req, res) {
        try {
            const { token } = req.body;

            // Verify token
            const decoded = verifyToken(token);
            if (!decoded) {
                throw new ApiError(401, 'Invalid token');
            }

            // Get user
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw new ApiError(401, 'Invalid token');
            }

            res.json({
                success: true,
                data: {
                    valid: true,
                    userId: user._id
                }
            });
        } catch (error) {
            logger.error('Verify token error:', error);
            // Don't throw error, just return invalid
            res.json({
                success: true,
                data: {
                    valid: false
                }
            });
        }
    },

    // Session Management
    async getUserSessions(req, res) {
        try {
            const sessions = await Session.find({ 
                user: req.user._id,
                isValid: true 
            }).sort({ lastActivity: -1 });

            res.json({
                success: true,
                data: sessions.map(session => ({
                    id: session._id,
                    userAgent: session.userAgent,
                    ip: session.ip,
                    lastActivity: session.lastActivity,
                    current: session._id.toString() === req.session._id.toString()
                }))
            });
        } catch (error) {
            logger.error('Get user sessions error:', error);
            throw error;
        }
    },

    async terminateSession(req, res) {
        try {
            const { sessionId } = req.params;

            // Don't allow terminating current session through this endpoint
            if (sessionId === req.session._id.toString()) {
                throw new ApiError(400, 'Cannot terminate current session. Use logout instead.');
            }

            // Verify session belongs to user
            const session = await Session.findOne({
                _id: sessionId,
                user: req.user._id
            });

            if (!session) {
                throw new ApiError(404, 'Session not found');
            }

            await session.deleteOne();

            res.json({
                success: true,
                message: 'Session terminated successfully'
            });
        } catch (error) {
            logger.error('Terminate session error:', error);
            throw error;
        }
    },

    async terminateAllSessions(req, res) {
        try {
            // Delete all sessions except current
            await Session.deleteMany({
                user: req.user._id,
                _id: { $ne: req.session._id }
            });

            res.json({
                success: true,
                message: 'All other sessions terminated successfully'
            });
        } catch (error) {
            logger.error('Terminate all sessions error:', error);
            throw error;
        }
    },

    // Account Management
    async deactivateAccount(req, res) {
        try {
            const user = await User.findById(req.user._id);

            // Update user status
            user.isActive = false;
            user.deactivatedAt = new Date();
            await user.save();

            // Terminate all sessions
            await Session.deleteMany({ user: user._id });

            res.json({
                success: true,
                message: 'Account deactivated successfully'
            });
        } catch (error) {
            logger.error('Deactivate account error:', error);
            throw error;
        }
    }
};

module.exports = authController; 