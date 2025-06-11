const jwt = require('jsonwebtoken');
const { ApiError } = require('./errors');

/**
 * Generate a JWT token
 * @param {Object} payload - Data to be encoded in the token
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = '1h') => {
    try {
        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
    } catch (error) {
        throw new ApiError(500, 'Error generating token');
    }
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken
}; 