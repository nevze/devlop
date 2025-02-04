const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../config/firebase');
const { User } = require('../models/user.model');
const logger = require('../config/logger');
const { cache } = require('../config/redis');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'No authorization header' });
        }

        const [authType, token] = authHeader.split(' ');

        if (authType === 'Bearer') {
            // JWT token authentication
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user from cache or database
            const user = await cache(`user:${decoded.userId}`, async () => {
                return await User.findById(decoded.userId);
            }, 3600); // Cache for 1 hour

            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            req.user = user;
            return next();
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
            return next();
        } else {
            return res.status(401).json({ message: 'Invalid authorization type' });
        }
    } catch (error) {
        logger.error(`Authentication error: ${error}`);
        return res.status(401).json({ message: 'Authentication failed' });
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        next();
    };
};

// API key authentication middleware
const apiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            return res.status(401).json({ message: 'API key is required' });
        }

        const user = await cache(`apikey:${apiKey}`, async () => {
            return await User.findOne({ 'apiKeys.key': apiKey });
        }, 3600); // Cache for 1 hour

        if (!user) {
            return res.status(401).json({ message: 'Invalid API key' });
        }

        const userApiKey = user.apiKeys.find(k => k.key === apiKey);
        if (userApiKey.expiresAt && userApiKey.expiresAt < new Date()) {
            return res.status(401).json({ message: 'API key has expired' });
        }

        req.user = user;
        req.apiKey = userApiKey;
        next();
    } catch (error) {
        logger.error(`API key authentication error: ${error}`);
        return res.status(401).json({ message: 'Authentication failed' });
    }
};

module.exports = {
    authMiddleware,
    authorize,
    apiKeyAuth
}; 