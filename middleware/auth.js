const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project');
const Role = require('../models/Role');
const RBACService = require('../services/rbacService');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');
const { AuthenticationError, ApiError } = require('../utils/errors');

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
            role: user.role._id,
            roleName: user.role.name,
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
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new ApiError(401, 'Authentication required');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).populate('role');

        if (!user) {
            throw new ApiError(401, 'User not found');
        }

        if (user.status !== 'active') {
            throw new ApiError(401, 'Account is not active');
        }

        req.user = decoded;
        req.userRole = user.role;
        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        if (error instanceof jwt.JsonWebTokenError) {
            next(new ApiError(401, 'Invalid token'));
        } else {
            next(error);
        }
    }
};

// Role-based authorization middleware
const authorize = (roles = [], options = {}) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        auth,
        async (req, res, next) => {
            try {
                if (!req.user) {
                    throw new AppError('Unauthorized', 401);
                }

                // Superadmin has all permissions
                if (req.user.role.name === 'superadmin') {
                    return next();
                }

                // Check if user's role is in the allowed roles
                if (roles.length && !roles.includes(req.user.role.name)) {
                    throw new AppError('Insufficient permissions', 403);
                }

                // Handle user management checks
                if (options.checkUserManagement) {
                    const targetUserId = req.params.id;
                    if (!targetUserId) {
                        throw new AppError('User ID is required', 400);
                    }

                    const targetUser = await User.findById(targetUserId)
                        .populate('role', 'name level')
                        .select('role')
                        .lean();

                    if (!targetUser) {
                        throw new AppError('Target user not found', 404);
                    }

                    // Compare role levels
                    const comparison = await RBACService.compareRoles(
                        req.user.role.name,
                        targetUser.role.name
                    );

                    // Prevent modification of users with same or higher role
                    // Exception: users can modify their own profile
                    if (comparison <= 0 && targetUser._id.toString() !== req.user._id.toString()) {
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

// Permission-based authorization middleware
const hasPermission = (permissionName) => {
    return [
        auth,
        async (req, res, next) => {
            try {
                if (!req.user) {
                    throw new AppError('Unauthorized', 401);
                }

                const hasPermission = await RBACService.hasPermission(req.user, permissionName);
                if (!hasPermission) {
                    throw new AppError('Insufficient permissions', 403);
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
            ['admin', 'superadmin'].includes(req.user.role.name);

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
           ['admin', 'superadmin'].includes(req.user.role.name);

       if (!hasAccess) return res.status(403).json({ message: 'Access denied' });
       next();
   } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const logout = async (req, res) => {
   try {
       const token = req.headers.authorization?.split(' ')[1];
       if (token) {
           // Add token to Redis blacklist with expiry matching the token's expiry
           const decoded = jwt.decode(token);
           if (decoded && decoded.exp) {
               const ttl = (decoded.exp * 1000) - Date.now();
               if (ttl > 0) {
                   await redis.set(`bl_${token}`, '1', 'PX', ttl);
               }
           }
           // Also add to in-memory blacklist as fallback
           tokenBlacklist.add(token);
       }
       res.json({ message: 'Logged out successfully' });
   } catch (error) {
       logger.error('Logout error:', error);
       res.status(500).json({ message: 'Logout failed' });
   }
};

const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!roles.includes(req.user.role.name)) {
      return next(new AuthenticationError('Not authorized to access this resource'));
    }

    next();
  };
};

// Admin authorization middleware
const isAdmin = async (req, res, next) => {
    try {
        if (!req.userRole || req.userRole.level < 70) {
            throw new ApiError(403, 'Admin access required');
        }
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
   loginLimiter,
   apiLimiter, 
   auth,
   authenticate : auth,
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
   tokenBlacklist,
   hasPermission,
   requireRoles,
   isAdmin
};