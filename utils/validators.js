const mongoose = require('mongoose');
const { AppError } = require('../middleware/errorHandler');

class Validators {
    // Check if string is valid MongoDB ObjectId
    static isValidObjectId(id) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    // Check if value is valid email
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Check if password meets requirements
    static isValidPassword(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    // Check if date is valid and not in the past
    static isValidFutureDate(date) {
        const dateObj = new Date(date);
        return dateObj instanceof Date && !isNaN(dateObj) && dateObj > new Date();
    }

    // Check if array contains only valid MongoDB ObjectIds
    static hasValidObjectIds(array) {
        return Array.isArray(array) && array.every(id => this.isValidObjectId(id));
    }

    // Check if value is within enum values
    static isValidEnum(value, enumValues) {
        return enumValues.includes(value);
    }

    // Validate required fields in object
    static validateRequired(obj, requiredFields) {
        const missingFields = requiredFields.filter(field => !obj[field]);
        if (missingFields.length > 0) {
            throw new AppError(400, `Missing required fields: ${missingFields.join(', ')}`);
        }
        return true;
    }

    // Validate field length
    static validateLength(value, options) {
        const length = value.length;
        if (options.min && length < options.min) {
            throw new AppError(400, `Value must be at least ${options.min} characters long`);
        }
        if (options.max && length > options.max) {
            throw new AppError(400, `Value must not exceed ${options.max} characters`);
        }
        return true;
    }

    // Validate number range
    static validateRange(value, options) {
        if (options.min && value < options.min) {
            throw new AppError(400, `Value must be at least ${options.min}`);
        }
        if (options.max && value > options.max) {
            throw new AppError(400, `Value must not exceed ${options.max}`);
        }
        return true;
    }

    // Validate file type
    static isValidFileType(mimetype, allowedTypes) {
        return allowedTypes.includes(mimetype);
    }

    // Validate file size
    static isValidFileSize(size, maxSize) {
        return size <= maxSize;
    }

    // Validate URL
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Validate phone number
    static isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s-]{10,}$/;
        return phoneRegex.test(phone);
    }

    // Validate date range
    static isValidDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return start < end;
    }

    // Sanitize string (remove HTML tags and trim)
    static sanitizeString(str) {
        return str.replace(/<[^>]*>/g, '').trim();
    }

    // Validate pagination parameters
    static validatePagination(page, limit) {
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
            throw new AppError(400, 'Page must be a positive integer');
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            throw new AppError(400, 'Limit must be between 1 and 100');
        }
        
        return { page: pageNum, limit: limitNum };
    }
}

module.exports = Validators; 