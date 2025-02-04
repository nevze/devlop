const { validationResult } = require('express-validator');
const { AppError } = require('./error.middleware');

// Middleware to validate request using express-validator
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        throw new AppError(errorMessages[0], 400);
    }
    next();
};

// Custom validators
const isValidUrl = (value) => {
    try {
        new URL(value);
        return true;
    } catch (error) {
        return false;
    }
};

const isValidObjectId = (value) => {
    return /^[0-9a-fA-F]{24}$/.test(value);
};

const isValidApiKey = (value) => {
    // API keys should be base64url encoded strings of sufficient length
    return /^[A-Za-z0-9_-]{43}$/.test(value);
};

const isValidDateString = (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
};

const isValidTier = (value) => {
    return ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'].includes(value);
};

const isValidRole = (value) => {
    return ['user', 'admin', 'superadmin'].includes(value);
};

const isValidPermissions = (value) => {
    if (!Array.isArray(value)) return false;
    return value.every(permission => ['read', 'write', 'admin'].includes(permission));
};

// Sanitizers
const sanitizeHtml = (value) => {
    if (typeof value !== 'string') return value;
    
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

const trimAll = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    return Object.keys(obj).reduce((acc, key) => {
        acc[key] = typeof obj[key] === 'string' ? obj[key].trim() : obj[key];
        return acc;
    }, {});
};

// Validation middleware factory
const createValidationMiddleware = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorMessages = error.details.map(detail => ({
                field: detail.path[0],
                message: detail.message
            }));
            
            throw new AppError('Validation failed', 400, errorMessages);
        }

        next();
    };
};

module.exports = {
    validateRequest,
    isValidUrl,
    isValidObjectId,
    isValidApiKey,
    isValidDateString,
    isValidTier,
    isValidRole,
    isValidPermissions,
    sanitizeHtml,
    trimAll,
    createValidationMiddleware
}; 