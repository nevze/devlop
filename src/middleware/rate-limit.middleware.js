const { incrementRequestCount } = require('../config/redis');
const logger = require('../config/logger');
const { AppError } = require('./error.middleware');

const TIER_LIMITS = {
    FREE: 100,
    BASIC: 1000,
    PRO: 10000,
    ENTERPRISE: Infinity
};

const createRateLimiter = (options = {}) => {
    const {
        windowMs = 60 * 1000, // 1 minute
        keyGenerator = (req) => {
            return req.user ? `rate-limit:${req.user._id}` : `rate-limit:${req.ip}`;
        },
        handler = (req, res) => {
            throw new AppError('Too many requests, please try again later.', 429);
        },
        skipFailedRequests = false,
        requestPropertyName = 'rateLimit'
    } = options;

    return async function rateLimitMiddleware(req, res, next) {
        try {
            const key = keyGenerator(req);
            
            // Get user's tier limit
            const tierLimit = req.user ? TIER_LIMITS[req.user.tier] || TIER_LIMITS.FREE : TIER_LIMITS.FREE;
            
            // Increment request count
            const currentCount = await incrementRequestCount(key);
            
            // Store rate limit info
            req[requestPropertyName] = {
                limit: tierLimit,
                current: currentCount,
                remaining: Math.max(0, tierLimit - currentCount)
            };

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', tierLimit);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, tierLimit - currentCount));
            
            // Check if over limit
            if (currentCount > tierLimit) {
                if (!skipFailedRequests) {
                    return handler(req, res, next);
                }
            }

            next();
        } catch (error) {
            logger.error(`Rate limiting error: ${error}`);
            next(error);
        }
    };
};

// Specific rate limiters for different purposes
const apiRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute window
    keyGenerator: (req) => `api-rate-limit:${req.user?._id || req.ip}:${req.baseUrl}`,
    handler: (req, res) => {
        throw new AppError('API rate limit exceeded. Please upgrade your plan for higher limits.', 429);
    }
});

const authRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    keyGenerator: (req) => `auth-rate-limit:${req.ip}`,
    handler: (req, res) => {
        throw new AppError('Too many authentication attempts. Please try again later.', 429);
    }
});

const scrapingRateLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute window
    keyGenerator: (req) => `scraping-rate-limit:${req.user?._id}:${req.body.url || req.query.url}`,
    handler: (req, res) => {
        throw new AppError('Scraping rate limit exceeded. Please wait before making more requests.', 429);
    }
});

module.exports = {
    createRateLimiter,
    apiRateLimiter,
    authRateLimiter,
    scrapingRateLimiter
}; 