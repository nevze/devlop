const express = require('express');
const { body } = require('express-validator');
const { authMiddleware, authorize, apiKeyAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { apiRateLimiter } = require('../middleware/rate-limit.middleware');
const {
    getCurrentUser,
    updateProfile,
    generateApiKey,
    listApiKeys,
    revokeApiKey,
    getUsageStats,
    updatePassword,
    deleteAccount,
    updateNotificationSettings,
    getActivityLog
} = require('../controllers/user.controller');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get current user
router.get(
    '/me',
    getCurrentUser
);

// Update profile
router.put(
    '/me',
    [
        body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email'),
        body('company').optional().trim(),
        body('website')
            .optional()
            .isURL()
            .withMessage('Please provide a valid URL'),
        body('timezone').optional().trim(),
        body('bio').optional().trim()
    ],
    validateRequest,
    updateProfile
);

// API key management
router.post(
    '/api-keys',
    [
        body('name').trim().notEmpty().withMessage('API key name is required'),
        body('expiresIn')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Expiration must be a positive number'),
        body('permissions')
            .optional()
            .isArray()
            .withMessage('Permissions must be an array')
    ],
    validateRequest,
    generateApiKey
);

router.get('/api-keys', listApiKeys);

router.delete(
    '/api-keys/:keyId',
    [
        body('keyId').notEmpty().withMessage('API key ID is required')
    ],
    validateRequest,
    revokeApiKey
);

// Usage statistics
router.get(
    '/usage',
    apiRateLimiter,
    getUsageStats
);

// Update password
router.put(
    '/password',
    [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
    ],
    validateRequest,
    updatePassword
);

// Delete account
router.delete(
    '/me',
    [
        body('password').notEmpty().withMessage('Password is required for account deletion')
    ],
    validateRequest,
    deleteAccount
);

// Notification settings
router.put(
    '/notifications',
    [
        body('email').optional().isBoolean(),
        body('push').optional().isBoolean(),
        body('usageAlerts').optional().isBoolean(),
        body('newsletterSubscription').optional().isBoolean(),
        body('marketingEmails').optional().isBoolean()
    ],
    validateRequest,
    updateNotificationSettings
);

// Activity log
router.get(
    '/activity',
    [
        body('startDate').optional().isISO8601(),
        body('endDate').optional().isISO8601(),
        body('type').optional().isString(),
        body('limit').optional().isInt({ min: 1, max: 100 }),
        body('page').optional().isInt({ min: 1 })
    ],
    validateRequest,
    getActivityLog
);

module.exports = router; 