/**
 * Wraps async route handlers to properly catch and forward errors to error handling middleware
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    asyncHandler
}; 