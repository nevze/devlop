const { Activity } = require('../models/activity.model');
const logger = require('../config/logger');

const activityLogger = async (req, res, next) => {
    const startTime = Date.now();
    const oldJson = res.json;
    let responseBody;

    // Override res.json to capture response body
    res.json = function(data) {
        responseBody = data;
        return oldJson.apply(res, arguments);
    };

    res.on('finish', async () => {
        try {
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Skip logging for certain endpoints
            if (req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
                return;
            }

            // Determine activity type based on path
            let type = 'api';
            if (req.path.startsWith('/auth')) type = 'auth';
            else if (req.path.startsWith('/admin')) type = 'admin';
            else if (req.path.includes('settings')) type = 'settings';
            else if (req.path.includes('profile')) type = 'profile';
            else if (req.path.includes('subscription')) type = 'subscription';

            // Create activity log
            const activity = {
                userId: req.user?._id || 'anonymous',
                type,
                action: `${req.method} ${req.path}`,
                description: `${req.method} request to ${req.path}`,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                status: res.statusCode < 400 ? 'success' : res.statusCode < 500 ? 'failure' : 'error',
                statusCode: res.statusCode,
                endpoint: req.path,
                method: req.method,
                requestBody: req.body,
                responseBody,
                responseTime,
                apiKeyId: req.apiKey?._id,
                metadata: {
                    query: req.query,
                    params: req.params,
                    headers: {
                        ...req.headers,
                        authorization: undefined, // Remove sensitive headers
                        cookie: undefined
                    }
                }
            };

            // Add error details if present
            if (res.statusCode >= 400 && responseBody?.error) {
                activity.errorDetails = {
                    code: responseBody.error.code,
                    message: responseBody.error.message,
                    stack: process.env.NODE_ENV === 'development' ? responseBody.error.stack : undefined
                };
            }

            await Activity.create(activity);
        } catch (error) {
            logger.error(`Failed to log activity: ${error}`);
        }
    });

    next();
};

// Activity tracking for specific actions
const trackActivity = (type, action, description) => {
    return async (req, res, next) => {
        const oldJson = res.json;
        let responseBody;

        res.json = function(data) {
            responseBody = data;
            return oldJson.apply(res, arguments);
        };

        try {
            const activity = {
                userId: req.user._id,
                type,
                action,
                description: typeof description === 'function' ? description(req) : description,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                status: 'success',
                metadata: {
                    query: req.query,
                    params: req.params
                }
            };

            // Store activity in request for later use
            req.activity = activity;

            // After response is sent
            res.on('finish', async () => {
                activity.status = res.statusCode < 400 ? 'success' : res.statusCode < 500 ? 'failure' : 'error';
                activity.statusCode = res.statusCode;
                activity.responseBody = responseBody;

                if (res.statusCode >= 400 && responseBody?.error) {
                    activity.errorDetails = {
                        code: responseBody.error.code,
                        message: responseBody.error.message,
                        stack: process.env.NODE_ENV === 'development' ? responseBody.error.stack : undefined
                    };
                }

                await Activity.create(activity);
            });

            next();
        } catch (error) {
            logger.error(`Failed to track activity: ${error}`);
            next(error);
        }
    };
};

// Track changes in data
const trackChanges = (model, fields) => {
    return async (req, res, next) => {
        try {
            const oldData = await model.findById(req.params.id);
            if (!oldData) {
                return next();
            }

            const changes = [];
            fields.forEach(field => {
                if (req.body[field] !== undefined && req.body[field] !== oldData[field]) {
                    changes.push({
                        field,
                        oldValue: oldData[field],
                        newValue: req.body[field]
                    });
                }
            });

            if (changes.length > 0) {
                req.activity = {
                    ...(req.activity || {}),
                    changes
                };
            }

            next();
        } catch (error) {
            logger.error(`Failed to track changes: ${error}`);
            next(error);
        }
    };
};

module.exports = {
    activityLogger,
    trackActivity,
    trackChanges
}; 