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

// Get user profile
router.get('/profile', (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                tier: req.user.tier,
                isEmailVerified: req.user.isEmailVerified,
                company: req.user.company,
                website: req.user.website,
                timezone: req.user.timezone,
                bio: req.user.bio,
                avatar: req.user.avatar,
                notificationSettings: req.user.notificationSettings
            }
        }
    });
});

// Update user profile
router.patch('/profile', [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('company').optional().trim(),
    body('website').optional().trim().isURL().withMessage('Please provide a valid URL'),
    body('timezone').optional().trim(),
    body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    validateRequest
], async (req, res) => {
    const allowedFields = ['name', 'company', 'website', 'timezone', 'bio'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
            updates[key] = req.body[key];
        }
    });
    
    Object.assign(req.user, updates);
    await req.user.save();
    
    res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user: req.user }
    });
});

// Update notification settings
router.patch('/notifications', [
    body('email').optional().isBoolean(),
    body('push').optional().isBoolean(),
    body('usageAlerts').optional().isBoolean(),
    body('newsletterSubscription').optional().isBoolean(),
    body('marketingEmails').optional().isBoolean(),
    validateRequest
], async (req, res) => {
    const allowedSettings = ['email', 'push', 'usageAlerts', 'newsletterSubscription', 'marketingEmails'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
        if (allowedSettings.includes(key)) {
            updates[`notificationSettings.${key}`] = req.body[key];
        }
    });
    
    Object.assign(req.user.notificationSettings, updates);
    await req.user.save();
    
    res.status(200).json({
        status: 'success',
        message: 'Notification settings updated successfully',
        data: { notificationSettings: req.user.notificationSettings }
    });
});

// Generate API key
router.post('/api-keys', [
    body('name').trim().notEmpty().withMessage('API key name is required'),
    body('permissions').optional().isArray(),
    body('expiresIn').optional().isNumeric(),
    validateRequest
], async (req, res) => {
    const apiKey = req.user.generateApiKey(
        req.body.name,
        req.body.permissions,
        req.body.expiresIn
    );
    
    await req.user.save();
    
    res.status(201).json({
        status: 'success',
        message: 'API key generated successfully',
        data: { apiKey }
    });
});

// List API keys
router.get('/api-keys', (req, res) => {
    const apiKeys = req.user.apiKeys.map(key => ({
        name: key.name,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        expiresAt: key.expiresAt,
        permissions: key.permissions
    }));
    
    res.status(200).json({
        status: 'success',
        data: { apiKeys }
    });
});

// Delete API key
router.delete('/api-keys/:keyId', async (req, res) => {
    req.user.apiKeys = req.user.apiKeys.filter(
        key => key._id.toString() !== req.params.keyId
    );
    
    await req.user.save();
    
    res.status(200).json({
        status: 'success',
        message: 'API key deleted successfully'
    });
});

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
router.delete('/account', [
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
], async (req, res) => {
    const { password } = req.body;
    
    // Verify password
    const isValid = await req.user.correctPassword(password, req.user.password);
    if (!isValid) {
        return res.status(401).json({
            status: 'error',
            message: 'Incorrect password'
        });
    }
    
    // Deactivate account
    req.user.active = false;
    await req.user.save();
    
    res.status(200).json({
        status: 'success',
        message: 'Account deleted successfully'
    });
});

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