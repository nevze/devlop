const { User } = require('../models/user.model');
const { AppError } = require('../middleware/error.middleware');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

// Get current user
const getCurrentUser = async (req, res) => {
    const user = await User.findById(req.user._id);
    
    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                tier: user.tier,
                isEmailVerified: user.isEmailVerified,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        }
    });
};

// Update profile
const updateProfile = async (req, res) => {
    const allowedFields = ['name', 'email', 'company', 'website', 'timezone', 'bio'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
            updates[key] = req.body[key];
        }
    });

    if (updates.email && updates.email !== req.user.email) {
        // If email is being changed, require reverification
        updates.isEmailVerified = false;
        
        // Send verification email
        const verificationToken = req.user.createEmailVerificationToken();
        await req.user.save();

        try {
            await sendEmail({
                to: updates.email,
                template: 'emailVerification',
                context: {
                    name: req.user.name,
                    verificationUrl: `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`
                }
            });
        } catch (error) {
            logger.error(`Failed to send verification email: ${error}`);
        }
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
    );

    // Clear user cache
    await cache.del(`user:${user._id}`);

    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                company: user.company,
                website: user.website,
                timezone: user.timezone,
                bio: user.bio,
                isEmailVerified: user.isEmailVerified
            }
        }
    });
};

// Generate API key
const generateApiKey = async (req, res) => {
    const { name, expiresIn, permissions } = req.body;

    // Check API key limit based on tier
    const keyLimits = {
        FREE: 1,
        BASIC: 3,
        PRO: 10,
        ENTERPRISE: 50
    };

    if (req.user.apiKeys.length >= keyLimits[req.user.tier]) {
        throw new AppError(`API key limit reached for ${req.user.tier} tier`, 403);
    }

    const apiKey = req.user.createApiKey(name, permissions, expiresIn);
    await req.user.save();

    res.status(201).json({
        status: 'success',
        data: {
            apiKey,
            name,
            permissions,
            expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null
        }
    });
};

// List API keys
const listApiKeys = async (req, res) => {
    const user = await User.findById(req.user._id);

    res.status(200).json({
        status: 'success',
        data: {
            apiKeys: user.apiKeys.map(key => ({
                id: key._id,
                name: key.name,
                createdAt: key.createdAt,
                expiresAt: key.expiresAt,
                lastUsed: key.lastUsed,
                permissions: key.permissions
            }))
        }
    });
};

// Revoke API key
const revokeApiKey = async (req, res) => {
    const { keyId } = req.params;

    const user = await User.findById(req.user._id);
    const keyIndex = user.apiKeys.findIndex(key => key._id.toString() === keyId);

    if (keyIndex === -1) {
        throw new AppError('API key not found', 404);
    }

    user.apiKeys.splice(keyIndex, 1);
    await user.save();

    res.status(200).json({
        status: 'success',
        message: 'API key revoked successfully'
    });
};

// Get usage statistics
const getUsageStats = async (req, res) => {
    const stats = await cache.get(`usage:${req.user._id}`);
    
    if (!stats) {
        // Calculate stats from database if not in cache
        const user = await User.findById(req.user._id);
        
        const stats = {
            apiCalls: user.usage.apiCalls,
            lastReset: user.usage.lastReset,
            tier: user.tier,
            limits: {
                apiCalls: {
                    FREE: 1000,
                    BASIC: 10000,
                    PRO: 100000,
                    ENTERPRISE: 1000000
                }[user.tier]
            }
        };

        // Cache for 5 minutes
        await cache.set(`usage:${req.user._id}`, JSON.stringify(stats), 300);
        
        return res.status(200).json({
            status: 'success',
            data: { stats }
        });
    }

    res.status(200).json({
        status: 'success',
        data: { stats: JSON.parse(stats) }
    });
};

// Update password
const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.correctPassword(currentPassword, user.password))) {
        throw new AppError('Current password is incorrect', 401);
    }

    user.password = newPassword;
    await user.save();

    // Generate new tokens
    const token = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    res.status(200).json({
        status: 'success',
        data: {
            token,
            refreshToken
        }
    });
};

// Delete account
const deleteAccount = async (req, res) => {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.correctPassword(password, user.password))) {
        throw new AppError('Password is incorrect', 401);
    }

    // Soft delete
    user.active = false;
    await user.save();

    // Clear user cache
    await cache.del(`user:${user._id}`);
    await cache.del(`usage:${user._id}`);

    res.status(200).json({
        status: 'success',
        message: 'Account deleted successfully'
    });
};

// Update notification settings
const updateNotificationSettings = async (req, res) => {
    const allowedSettings = ['email', 'push', 'usageAlerts', 'newsletterSubscription', 'marketingEmails'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
        if (allowedSettings.includes(key)) {
            updates[`notificationSettings.${key}`] = req.body[key];
        }
    });

    const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true }
    );

    res.status(200).json({
        status: 'success',
        data: {
            notificationSettings: user.notificationSettings
        }
    });
};

// Get activity log
const getActivityLog = async (req, res) => {
    const { startDate, endDate, type, limit = 10, page = 1 } = req.body;
    
    const query = { userId: req.user._id };
    
    if (startDate) query.createdAt = { $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    if (type) query.type = type;

    const activities = await Activity.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const total = await Activity.countDocuments(query);

    res.status(200).json({
        status: 'success',
        data: {
            activities,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        }
    });
};

module.exports = {
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
}; 