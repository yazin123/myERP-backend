const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a new 2FA secret and QR code
 * @param {string} email - User's email
 * @returns {Promise<Object>} Object containing secret and QR code
 */
const generate2FASecret = async (email) => {
    const secret = speakeasy.generateSecret({
        name: `Nesa ERP (${email})`
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
        secret: secret.base32,
        qrCode
    };
};

/**
 * Verify a 2FA token
 * @param {string} token - Token to verify
 * @param {string} secret - User's 2FA secret
 * @returns {boolean} True if token is valid
 */
const verify2FAToken = (token, secret) => {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: token.toString(),
        window: 1 // Allow 30 seconds of time drift
    });
};

/**
 * Generate backup codes
 * @returns {Promise<string[]>} Array of backup codes
 */
const generateBackupCodes = async () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
};

module.exports = {
    generate2FASecret,
    verify2FAToken,
    generateBackupCodes
}; 