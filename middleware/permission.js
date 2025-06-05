const { AppError } = require('./errorHandler');
const RBACService = require('../services/rbacService');
const logger = require('../utils/logger');

// Permission-based authorization middleware
const checkPermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new AppError(401, 'Unauthorized');
            }

            // If user has no role, deny access
            if (!req.user.role) {
                logger.error(`No role found for user ${req.user._id}`);
                throw new AppError(403, 'Insufficient permissions');
            }

            // Check if user has the required permission
            const hasPermission = await RBACService.hasPermission(req.user, permissionName);
            
            if (!hasPermission) {
                logger.warn(`User ${req.user._id} denied access to ${permissionName}`);
                throw new AppError(403, 'Insufficient permissions');
            }

            next();
        } catch (error) {
            if (error instanceof AppError) {
                next(error);
            } else {
                logger.error('Permission check error:', error);
                next(new AppError(500, 'Internal server error'));
            }
        }
    };
};

module.exports = {
    checkPermission
}; 