const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { verifyFirebaseToken } = require('../config/firebase');
const { User } = require('../models/user.model');
const { AppError } = require('./error.middleware');
const logger = require('../config/logger');
const { cache } = require('../config/redis');

// Authentication middleware
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new AppError('No authorization header', 401);
        }

        const [authType, token] = authHeader.split(' ');

        if (authType === 'Bearer') {
            // JWT token authentication
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user from cache or database
            const user = await cache.get(`user:${decoded.userId}`, async () => {
                return await User.findById(decoded.userId);
            }, 3600); // Cache for 1 hour

            if (!user) {
                throw new AppError('User not found', 401);
            }

            req.user = user;
            next();
        } else if (authType === 'Firebase') {
            // Firebase token authentication
            const decodedToken = await verifyFirebaseToken(token);
            
            // Get or create user
            let user = await User.findOne({ email: decodedToken.email });
            
            if (!user) {
                user = await User.create({
                    email: decodedToken.email,
                    firebaseUid: decodedToken.uid,
                    name: decodedToken.name || decodedToken.email.split('@')[0],
                    isEmailVerified: decodedToken.email_verified
                });
            }

            req.user = user;
            next();
        } else {
            throw new AppError('Invalid authorization type', 401);
        }
    } catch (error) {
        logger.error(`Authentication error: ${error}`);
        throw new AppError('Authentication failed', 401);
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new AppError('User not authenticated', 401);
        }

        if (!roles.includes(req.user.role)) {
            throw new AppError('Unauthorized access', 403);
        }

        next();
    };
};

// Rate limiter for auth routes
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false
});

// API key authentication middleware
const apiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            throw new AppError('API key is required', 401);
        }

        const user = await cache.get(`apikey:${apiKey}`, async () => {
            return await User.findOne({ 'apiKeys.key': apiKey });
        }, 3600); // Cache for 1 hour

        if (!user) {
            throw new AppError('Invalid API key', 401);
        }

        const userApiKey = user.apiKeys.find(k => k.key === apiKey);
        if (userApiKey.expiresAt && userApiKey.expiresAt < new Date()) {
            throw new AppError('API key has expired', 401);
        }

        req.user = user;
        req.apiKey = userApiKey;
        next();
    } catch (error) {
        logger.error(`API key authentication error: ${error}`);
        throw new AppError('Authentication failed', 401);
    }
};

module.exports = {
    authMiddleware,
    authorize,
    authRateLimiter,
    apiKeyAuth
}; 