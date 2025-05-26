const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project')
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

// Initialize Redis client for token blacklist
const redis = new Redis(process.env.REDIS_URL);

// Initialize token blacklist Set (in-memory fallback)
const tokenBlacklist = new Set();

// Rate limiting configurations
const loginLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: 5, 
    message: 'Too many login attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
   windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Token generation
const generateTokens = (user) => ({
   accessToken: jwt.sign(
        { 
            userId: user._id, 
            role: user.role,
            email: user.email 
        },
       process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '15m' }
   ),
   refreshToken: jwt.sign(
       { userId: user._id },
       process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
   )
});

// Verify JWT token
const verifyToken = async (token, secret) => {
    try {
        const decoded = jwt.verify(token, secret);
        
        // Check if token is blacklisted
        const isBlacklisted = await redis.get(`bl_${token}`);
        if (isBlacklisted) {
            throw new AppError('Token has been invalidated', 401);
        }
        
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError('Token has expired', 401);
        }
        throw new AppError('Invalid token', 401);
    }
};

// Authentication middleware
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            throw new AppError('No token provided', 401);
        }
        
        const decoded = await verifyToken(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.userId)
            .select('-password')
            .lean();
            
        if (!user) {
            throw new AppError('User not found', 401);
        }
        
        if (user.status !== 'active') {
            throw new AppError('User account is not active', 403);
        }
        
        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

// Role-based authorization middleware
const authorize = (roles = [], options = {}) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        authenticate,
        async (req, res, next) => {
            try {
                if (!req.user) {
                    throw new AppError('Unauthorized', 401);
                }

                if (roles.length && !roles.includes(req.user.role)) {
                    throw new AppError('Insufficient permissions', 403);
                }

                // Handle user management checks
                if (options.checkUserManagement) {
                    const targetUserId = req.params.id;
                    if (!targetUserId) {
                        throw new AppError('User ID is required', 400);
                    }

                    const targetUser = await User.findById(targetUserId).select('role').lean();
                    if (!targetUser) {
                        throw new AppError('Target user not found', 404);
                    }

                    // Define role hierarchy
                    const roleHierarchy = {
                        'superadmin': 3,
                        'admin': 2,
                        'manager': 1,
                        'employee': 0
                    };

                    // Get role levels
                    const userRoleLevel = roleHierarchy[req.user.role] || 0;
                    const targetRoleLevel = roleHierarchy[targetUser.role] || 0;

                    // Prevent modification of users with same or higher role
                    // Exception: users can modify their own profile
                    if (targetRoleLevel >= userRoleLevel && 
                        targetUser._id.toString() !== req.user._id.toString()) {
                        throw new AppError('Cannot modify users with same or higher role', 403);
                    }
                }

                next();
            } catch (error) {
                next(error);
            }
        }
    ];
};

// Project access middleware
const checkProjectAccess = async (req, res, next) => {
    try {
        const projectId = req.params.id || req.body.projectId;
        
        if (!projectId) {
            throw new AppError('Project ID is required', 400);
        }

        const project = await Project.findById(projectId);
        if (!project) {
            throw new AppError('Project not found', 404);
        }

        const hasAccess = 
            project.projectHead.equals(req.user._id) ||
            project.members.includes(req.user._id) ||
            ['admin', 'superadmin'].includes(req.user.role);

        if (!hasAccess) {
            throw new AppError('Access denied to this project', 403);
        }

        req.project = project;
        next();
    } catch (error) {
        next(error);
    }
};

// Token blacklisting
const blacklistToken = async (token) => {
    try {
        const decoded = jwt.decode(token);
        const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);
        
        await redis.setex(`bl_${token}`, expiryTime, 'true');
    } catch (error) {
        logger.error('Error blacklisting token:', error);
    }
};

const loginAuth = async (req, res, next) => {
   try {
       const token = req.headers.authorization?.split(' ')[1];
       if (!token) return res.status(401).json({ message: 'Authentication required' });

       if (tokenBlacklist.has(token)) {
           return res.status(401).json({ message: 'Token revoked' });
       }

       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       const user = await User.findById(decoded.userId);
       
       if (!user || user.status !== 'active') {
           return res.status(401).json({ message: 'User inactive or not found' });
       }

       req.user = decoded;
       next();
   } catch (error) {
       if (error.name === 'TokenExpiredError') {
           return res.status(401).json({ message: 'Token expired' });
       }
       res.status(401).json({ message: 'Invalid token' });
   }
};

// Predefined role-based middleware
const adminAuth = authorize(['admin', 'superadmin']);
const teamLeadAuth = authorize(['teamlead']);
const superadminAuth = authorize(['superadmin']);

const refreshToken = async (req, res) => {
   try {
       const { refreshToken } = req.body;
       if (!refreshToken) {
           return res.status(401).json({ message: 'Refresh token required' });
       }

       const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
       const user = await User.findById(decoded.userId);

       if (!user || user.status !== 'active') {
           return res.status(401).json({ message: 'User inactive or not found' });
       }

       const tokens = generateTokens(user);
       res.json(tokens);
   } catch (error) {
       res.status(401).json({ message: 'Invalid refresh token' });
   }
};

const checkAccess = async (req, res, next) => {
   try {
       const lead = await Lead.findById(req.params.id);
       if (!lead) return res.status(404).json({ message: 'Lead not found' });

       const hasAccess =
           lead.leadOwner.equals(req.user.userId) ||
           lead.access.includes(req.user.userId) ||
           ['admin', 'superadmin'].includes(req.user.role);

       if (!hasAccess) return res.status(403).json({ message: 'Access denied' });
       next();
   } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const logout = async (req, res) => {
   try {
       const token = req.headers.authorization?.split(' ')[1];
       if (token) tokenBlacklist.add(token);
       res.json({ message: 'Logged out successfully' });
   } catch (error) {
       res.status(500).json({ message: 'Logout failed' });
   }
};

module.exports = {
   loginLimiter,
   apiLimiter, 
   authenticate,
   adminAuth,
   teamLeadAuth,
   superadminAuth,
   refreshToken,
   logout,
   generateTokens,
   checkAccess,
   checkProjectAccess,
   blacklistToken,
   authorize,
   tokenBlacklist
};