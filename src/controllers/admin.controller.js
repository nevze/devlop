const { User } = require('../models/user.model');
const { Activity } = require('../models/activity.model');
const { SystemSettings } = require('../models/system-settings.model');
const { AppError } = require('../middleware/error.middleware');
const { cache } = require('../config/redis');
const logger = require('../config/logger');
const stripe = require('../config/stripe');
const { exportToFile } = require('../utils/export');
const mongoose = require('mongoose');

// Get users with pagination and filters
const getUsers = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        sort = '-createdAt',
        search,
        role,
        tier,
        status
    } = req.query;

    const query = {};
    
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (role) query.role = role;
    if (tier) query.tier = tier;
    if (status) query.status = status;

    const users = await User.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-password');

    const total = await User.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: {
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        }
    });
};

// Get single user
const getUser = async (req, res) => {
    const user = await User.findById(req.params.userId)
        .select('-password')
        .populate('activities');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { user }
    });
};

// Update user
const updateUser = async (req, res) => {
    const allowedUpdates = ['name', 'email', 'role', 'tier', 'status'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
            updates[key] = req.body[key];
        }
    });

    const user = await User.findByIdAndUpdate(
        req.params.userId,
        updates,
        { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Clear user cache
    await cache.del(`user:${user._id}`);

    res.status(200).json({
        status: 'success',
        data: { user }
    });
};

// Delete user
const deleteUser = async (req, res) => {
    const user = await User.findById(req.params.userId);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Cancel Stripe subscription if exists
    if (user.subscription?.stripeSubscriptionId) {
        await stripe.subscriptions.del(user.subscription.stripeSubscriptionId);
    }

    // Soft delete
    user.active = false;
    await user.save();

    // Clear user cache
    await cache.del(`user:${user._id}`);
    await cache.del(`usage:${user._id}`);

    res.status(200).json({
        status: 'success',
        message: 'User deleted successfully'
    });
};

// Get analytics
const getAnalytics = async (req, res) => {
    const { startDate, endDate, interval = 'day' } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const [userStats, activityStats, revenueStats] = await Promise.all([
        // User statistics
        User.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    newUsers: { $sum: 1 },
                    tierDistribution: {
                        $push: '$tier'
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]),

        // Activity statistics
        Activity.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    totalActivities: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { _id: 1 } }
        ]),

        // Revenue statistics
        stripe.charges.list({
            created: {
                gte: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined,
                lte: endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined
            },
            limit: 100
        })
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            userStats,
            activityStats,
            revenueStats: revenueStats.data
        }
    });
};

// Get audit logs
const getAuditLogs = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        userId,
        action,
        resource
    } = req.query;

    const query = {};
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (resource) query.resource = resource;

    const logs = await Activity.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email');

    const total = await Activity.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: {
            logs,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        }
    });
};

// Get system health
const getSystemHealth = async (req, res) => {
    const [
        dbStatus,
        redisStatus,
        userCount,
        activeApiKeys,
        systemSettings
    ] = await Promise.all([
        mongoose.connection.db.admin().ping(),
        cache.ping(),
        User.countDocuments({ active: true }),
        User.aggregate([
            { $unwind: '$apiKeys' },
            { $match: { 'apiKeys.status': 'active' } },
            { $count: 'total' }
        ]),
        SystemSettings.findOne()
    ]);

    const health = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
            database: {
                status: dbStatus.ok ? 'healthy' : 'unhealthy',
                latency: dbStatus.ok ? 'normal' : 'high'
            },
            redis: {
                status: redisStatus === 'PONG' ? 'healthy' : 'unhealthy'
            }
        },
        metrics: {
            activeUsers: userCount,
            activeApiKeys: activeApiKeys[0]?.total || 0,
            systemSettings: {
                maintenanceMode: systemSettings?.maintenanceMode || false,
                version: systemSettings?.version
            }
        }
    };

    res.status(200).json({
        status: 'success',
        data: { health }
    });
};

// Update system settings
const updateSystemSettings = async (req, res) => {
    const allowedSettings = [
        'maintenanceMode',
        'allowRegistration',
        'defaultUserTier',
        'maxApiKeysPerUser',
        'rateLimitWindow',
        'rateLimitMax'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
        if (allowedSettings.includes(key)) {
            updates[key] = req.body[key];
        }
    });

    const settings = await SystemSettings.findOneAndUpdate(
        {},
        updates,
        { new: true, upsert: true }
    );

    // Clear system settings cache
    await cache.del('system:settings');

    res.status(200).json({
        status: 'success',
        data: { settings }
    });
};

// Manage user subscription
const manageUserSubscription = async (req, res) => {
    const { tier, status, expiresAt } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Update subscription in Stripe if it exists
    if (user.subscription?.stripeSubscriptionId) {
        await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
            cancel_at: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
            metadata: { tier }
        });
    }

    user.tier = tier;
    user.subscription = {
        ...user.subscription,
        status: status || user.subscription?.status,
        currentPeriodEnd: expiresAt || user.subscription?.currentPeriodEnd
    };

    await user.save();

    // Clear user cache
    await cache.del(`user:${user._id}`);

    res.status(200).json({
        status: 'success',
        data: {
            subscription: user.subscription
        }
    });
};

// Get user activity
const getUserActivity = async (req, res) => {
    const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        type
    } = req.query;

    const query = { userId: req.params.userId };
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (type) query.type = type;

    const activities = await Activity.find(query)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit);

    const total = await Activity.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: {
            activities,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        }
    });
};

// Get API usage
const getApiUsage = async (req, res) => {
    const { startDate, endDate, userId, endpoint } = req.query;

    const query = {};
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    if (userId) query.userId = userId;
    if (endpoint) query.endpoint = endpoint;

    const usage = await Activity.aggregate([
        { $match: query },
        {
            $group: {
                _id: {
                    userId: '$userId',
                    endpoint: '$endpoint',
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$timestamp'
                        }
                    }
                },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$responseTime' },
                errors: {
                    $sum: {
                        $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
                    }
                }
            }
        },
        { $sort: { '_id.date': -1 } }
    ]);

    res.status(200).json({
        status: 'success',
        data: { usage }
    });
};

// Manage API keys
const manageApiKeys = async (req, res) => {
    const { status, permissions, expiresAt } = req.body;
    const { userId, keyId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        throw new AppError('User not found', 404);
    }

    const apiKey = user.apiKeys.id(keyId);
    if (!apiKey) {
        throw new AppError('API key not found', 404);
    }

    if (status) apiKey.status = status;
    if (permissions) apiKey.permissions = permissions;
    if (expiresAt) apiKey.expiresAt = new Date(expiresAt);

    await user.save();

    res.status(200).json({
        status: 'success',
        data: { apiKey }
    });
};

// Get revenue analytics
const getRevenue = async (req, res) => {
    const { startDate, endDate, interval = 'month' } = req.query;

    const charges = await stripe.charges.list({
        created: {
            gte: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined,
            lte: endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined
        },
        limit: 100
    });

    const revenue = charges.data.reduce((acc, charge) => {
        const date = new Date(charge.created * 1000);
        const key = interval === 'month'
            ? `${date.getFullYear()}-${date.getMonth() + 1}`
            : interval === 'day'
                ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
                : `${date.getFullYear()}`;

        if (!acc[key]) {
            acc[key] = {
                total: 0,
                successful: 0,
                failed: 0,
                refunded: 0
            };
        }

        const amount = charge.amount / 100; // Convert cents to dollars
        acc[key].total += amount;

        if (charge.refunded) {
            acc[key].refunded += amount;
        } else if (charge.status === 'succeeded') {
            acc[key].successful += amount;
        } else {
            acc[key].failed += amount;
        }

        return acc;
    }, {});

    res.status(200).json({
        status: 'success',
        data: { revenue }
    });
};

// Export data
const exportData = async (req, res) => {
    const { type, format, startDate, endDate, filters } = req.body;

    let data;
    switch (type) {
        case 'users':
            data = await User.find(filters).select('-password');
            break;
        case 'activity':
            data = await Activity.find({
                ...filters,
                ...(startDate || endDate ? {
                    createdAt: {
                        ...(startDate && { $gte: new Date(startDate) }),
                        ...(endDate && { $lte: new Date(endDate) })
                    }
                } : {})
            });
            break;
        case 'usage':
            data = await Activity.aggregate([
                {
                    $match: {
                        ...filters,
                        ...(startDate || endDate ? {
                            timestamp: {
                                ...(startDate && { $gte: new Date(startDate) }),
                                ...(endDate && { $lte: new Date(endDate) })
                            }
                        } : {})
                    }
                },
                {
                    $group: {
                        _id: {
                            userId: '$userId',
                            endpoint: '$endpoint',
                            date: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$timestamp'
                                }
                            }
                        },
                        count: { $sum: 1 },
                        avgResponseTime: { $avg: '$responseTime' },
                        errors: {
                            $sum: {
                                $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
                            }
                        }
                    }
                }
            ]);
            break;
        case 'revenue':
            const charges = await stripe.charges.list({
                created: {
                    gte: startDate ? Math.floor(new Date(startDate).getTime() / 1000) : undefined,
                    lte: endDate ? Math.floor(new Date(endDate).getTime() / 1000) : undefined
                },
                limit: 100
            });
            data = charges.data;
            break;
        default:
            throw new AppError('Invalid export type', 400);
    }

    const fileName = `export-${type}-${new Date().toISOString()}.${format}`;
    const fileContent = await exportToFile(data, format);

    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(fileContent);
};

module.exports = {
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
}; 