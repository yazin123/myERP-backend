const express = require('express');
const { checkPermission } = require('../../middleware/permission');
const { authenticate } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { asyncHandler } = require('../../middleware/asyncHandler');

/**
 * Base route class to be extended by specific route modules
 * @param {Object} controller - The controller containing the route handlers
 * @param {Object} validators - The validation schemas for the routes
 * @param {Object} permissions - The permission requirements for the routes
 */
class BaseRoutes {
    constructor(controller, validators = {}, permissions = {}) {
        this.controller = controller;
        this.validators = validators;
        this.permissions = permissions;
        this.router = express.Router();
        this.initializeRoutes();
    }

    /**
     * Initialize routes with proper middleware chain
     * @param {string} path - Route path
     * @param {string} method - HTTP method
     * @param {function} handler - Route handler from controller
     * @param {Object} options - Additional options (validation, permissions, authentication)
     */
    createRoute(path, method, handler, options = {}) {
        const middleware = [];

        // Add authentication middleware if required
        if (options.authenticate) {
            middleware.push(authenticate);
        }

        // Add permission check if specified
        if (options.permission) {
            middleware.push(checkPermission(options.permission));
        }

        // Add validation if specified
        if (options.validator) {
            if (Array.isArray(options.validator)) {
                middleware.push(...options.validator);
            } else {
                middleware.push(validateRequest(options.validator));
            }
        }

        // Add the route handler wrapped in asyncHandler
        middleware.push(asyncHandler(handler));

        // Register the route
        this.router[method.toLowerCase()](path, ...middleware);
    }

    // Override this method in specific route classes
    initializeRoutes() {
        throw new Error('initializeRoutes must be implemented by child class');
    }

    getRouter() {
        return this.router;
    }
}

module.exports = BaseRoutes; 