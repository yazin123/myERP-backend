const { AppError } = require('../utils/error');
const RBACService = require('../services/rbacService');
const logger = require('../utils/logger');

// Permission-based authorization middleware
const checkPermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                throw new AppError('Unauthorized', 401);
            }

            // If user has no role, deny access
            if (!req.user.role) {
                logger.error(`No role found for user ${req.user._id}`);
                throw new AppError('Insufficient permissions', 403);
            }

            // Check if user has the required permission
            const hasPermission = await RBACService.hasPermission(req.user, permissionName);
            
            if (!hasPermission) {
                logger.warn(`User ${req.user._id} denied access to ${permissionName}`);
                throw new AppError('Insufficient permissions', 403);
            }

            next();
        } catch (error) {
            if (error instanceof AppError) {
                next(error);
            } else {
                logger.error('Permission check error:', error);
                next(new AppError('Internal server error', 500));
            }
        }
    };
};

module.exports = {
    checkPermission
}; 