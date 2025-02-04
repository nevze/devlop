const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'auth',          // Authentication related activities
            'api',           // API calls
            'subscription',  // Subscription changes
            'profile',       // Profile updates
            'settings',      // Settings changes
            'admin',         // Admin actions
            'system'         // System events
        ]
    },
    action: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String
    },
    userAgent: {
        type: String
    },
    status: {
        type: String,
        enum: ['success', 'failure', 'error'],
        default: 'success'
    },
    statusCode: {
        type: Number
    },
    endpoint: {
        type: String
    },
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },
    requestBody: {
        type: mongoose.Schema.Types.Mixed
    },
    responseBody: {
        type: mongoose.Schema.Types.Mixed
    },
    responseTime: {
        type: Number // in milliseconds
    },
    apiKeyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User.apiKeys'
    },
    changes: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    errorDetails: {
        code: String,
        message: String,
        stack: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ userId: 1, type: 1, createdAt: -1 });
activitySchema.index({ endpoint: 1, method: 1, createdAt: -1 });

// Methods
activitySchema.methods.toAuditLog = function() {
    return {
        id: this._id,
        timestamp: this.createdAt,
        userId: this.userId,
        type: this.type,
        action: this.action,
        description: this.description,
        status: this.status,
        ip: this.ip,
        metadata: this.metadata,
        changes: this.changes
    };
};

// Statics
activitySchema.statics.logActivity = async function(data) {
    try {
        const activity = new this(data);
        await activity.save();
        return activity;
    } catch (error) {
        logger.error(`Failed to log activity: ${error}`);
        throw error;
    }
};

activitySchema.statics.getActivityStats = async function(userId, startDate, endDate) {
    const match = {
        userId: mongoose.Types.ObjectId(userId)
    };

    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    type: '$type',
                    status: '$status'
                },
                count: { $sum: 1 },
                avgResponseTime: {
                    $avg: {
                        $cond: [
                            { $ifNull: ['$responseTime', false] },
                            '$responseTime',
                            null
                        ]
                    }
                }
            }
        },
        {
            $group: {
                _id: '$_id.type',
                total: { $sum: '$count' },
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        avgResponseTime: '$avgResponseTime'
                    }
                }
            }
        }
    ]);
};

// Middleware
activitySchema.pre('save', function(next) {
    // Sanitize request and response bodies to remove sensitive information
    if (this.requestBody) {
        delete this.requestBody.password;
        delete this.requestBody.token;
    }
    if (this.responseBody) {
        delete this.responseBody.token;
    }
    next();
});

const Activity = mongoose.model('Activity', activitySchema);

module.exports = { Activity }; 