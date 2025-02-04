const express = require('express');
const { body, query } = require('express-validator');
const { authMiddleware, authorize } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    getAnalytics,
    getAuditLogs,
    getSystemHealth,
    updateSystemSettings,
    manageUserSubscription,
    getUserActivity,
    getApiUsage,
    manageApiKeys,
    getRevenue,
    exportData
} = require('../controllers/admin.controller');

const router = express.Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize('admin', 'superadmin'));

// User management
router.get(
    '/users',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('sort').optional().isString(),
        query('search').optional().isString(),
        query('role').optional().isIn(['user', 'admin', 'superadmin']),
        query('tier').optional().isIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
        query('status').optional().isIn(['active', 'inactive', 'suspended'])
    ],
    validateRequest,
    getUsers
);

router.get(
    '/users/:userId',
    getUser
);

router.put(
    '/users/:userId',
    [
        body('name').optional().trim().notEmpty(),
        body('email').optional().isEmail(),
        body('role').optional().isIn(['user', 'admin']),
        body('tier').optional().isIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
        body('status').optional().isIn(['active', 'inactive', 'suspended'])
    ],
    validateRequest,
    updateUser
);

router.delete(
    '/users/:userId',
    deleteUser
);

// Analytics
router.get(
    '/analytics',
    [
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('interval').optional().isIn(['hour', 'day', 'week', 'month'])
    ],
    validateRequest,
    getAnalytics
);

// Audit logs
router.get(
    '/audit-logs',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('userId').optional().isMongoId(),
        query('action').optional().isString(),
        query('resource').optional().isString()
    ],
    validateRequest,
    getAuditLogs
);

// System health
router.get(
    '/system-health',
    getSystemHealth
);

// System settings
router.put(
    '/system-settings',
    [
        body('maintenanceMode').optional().isBoolean(),
        body('allowRegistration').optional().isBoolean(),
        body('defaultUserTier').optional().isIn(['FREE', 'BASIC']),
        body('maxApiKeysPerUser').optional().isInt({ min: 1 }),
        body('rateLimitWindow').optional().isInt({ min: 1 }),
        body('rateLimitMax').optional().isInt({ min: 1 })
    ],
    validateRequest,
    updateSystemSettings
);

// Subscription management
router.put(
    '/users/:userId/subscription',
    [
        body('tier').isIn(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']),
        body('status').optional().isIn(['active', 'canceled', 'past_due', 'unpaid']),
        body('expiresAt').optional().isISO8601()
    ],
    validateRequest,
    manageUserSubscription
);

// User activity
router.get(
    '/users/:userId/activity',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('type').optional().isString()
    ],
    validateRequest,
    getUserActivity
);

// API usage
router.get(
    '/api-usage',
    [
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('userId').optional().isMongoId(),
        query('endpoint').optional().isString()
    ],
    validateRequest,
    getApiUsage
);

// API key management
router.put(
    '/users/:userId/api-keys/:keyId',
    [
        body('status').isIn(['active', 'revoked']),
        body('permissions').optional().isArray(),
        body('expiresAt').optional().isISO8601()
    ],
    validateRequest,
    manageApiKeys
);

// Revenue analytics
router.get(
    '/revenue',
    [
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
        query('interval').optional().isIn(['day', 'week', 'month', 'year'])
    ],
    validateRequest,
    getRevenue
);

// Data export
router.post(
    '/export',
    [
        body('type').isIn(['users', 'activity', 'usage', 'revenue']),
        body('format').isIn(['csv', 'json']),
        body('startDate').optional().isISO8601(),
        body('endDate').optional().isISO8601(),
        body('filters').optional().isObject()
    ],
    validateRequest,
    exportData
);

module.exports = router; 