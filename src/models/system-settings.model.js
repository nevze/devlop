const mongoose = require('mongoose');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

const systemSettingsSchema = new mongoose.Schema({
    maintenanceMode: {
        enabled: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: 'System is under maintenance. Please try again later.'
        },
        allowedIPs: [{
            type: String
        }]
    },
    registration: {
        enabled: {
            type: Boolean,
            default: true
        },
        requireEmailVerification: {
            type: Boolean,
            default: true
        },
        allowedDomains: [{
            type: String
        }],
        defaultUserTier: {
            type: String,
            enum: ['FREE', 'BASIC'],
            default: 'FREE'
        }
    },
    security: {
        maxLoginAttempts: {
            type: Number,
            default: 5
        },
        lockoutDuration: {
            type: Number,
            default: 15 // minutes
        },
        passwordPolicy: {
            minLength: {
                type: Number,
                default: 8
            },
            requireUppercase: {
                type: Boolean,
                default: true
            },
            requireLowercase: {
                type: Boolean,
                default: true
            },
            requireNumbers: {
                type: Boolean,
                default: true
            },
            requireSpecialChars: {
                type: Boolean,
                default: true
            }
        },
        sessionTimeout: {
            type: Number,
            default: 60 // minutes
        }
    },
    api: {
        rateLimiting: {
            enabled: {
                type: Boolean,
                default: true
            },
            windowMs: {
                type: Number,
                default: 900000 // 15 minutes
            },
            maxRequestsPerIP: {
                type: Number,
                default: 100
            }
        },
        versioning: {
            enabled: {
                type: Boolean,
                default: true
            },
            current: {
                type: String,
                default: 'v1'
            },
            supported: [{
                type: String
            }]
        },
        cors: {
            allowedOrigins: [{
                type: String
            }],
            allowCredentials: {
                type: Boolean,
                default: true
            }
        }
    },
    email: {
        provider: {
            type: String,
            enum: ['sendgrid', 'smtp', 'ses'],
            default: 'sendgrid'
        },
        fromName: {
            type: String,
            default: 'API Platform'
        },
        fromEmail: {
            type: String,
            default: 'noreply@example.com'
        },
        templates: {
            welcome: {
                subject: {
                    type: String,
                    default: 'Welcome to API Platform'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            },
            passwordReset: {
                subject: {
                    type: String,
                    default: 'Password Reset Request'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            },
            emailVerification: {
                subject: {
                    type: String,
                    default: 'Please verify your email'
                },
                enabled: {
                    type: Boolean,
                    default: true
                }
            }
        }
    },
    features: {
        googleAuth: {
            enabled: {
                type: Boolean,
                default: true
            }
        },
        apiKeys: {
            enabled: {
                type: Boolean,
                default: true
            },
            expirationEnabled: {
                type: Boolean,
                default: true
            }
        },
        webhooks: {
            enabled: {
                type: Boolean,
                default: true
            },
            maxPerUser: {
                type: Number,
                default: 10
            }
        },
        export: {
            enabled: {
                type: Boolean,
                default: true
            },
            formats: [{
                type: String,
                enum: ['csv', 'json', 'xml']
            }]
        }
    },
    billing: {
        currency: {
            type: String,
            default: 'USD'
        },
        taxRate: {
            type: Number,
            default: 0
        },
        trialDays: {
            type: Number,
            default: 14
        }
    },
    cache: {
        enabled: {
            type: Boolean,
            default: true
        },
        ttl: {
            type: Number,
            default: 3600 // 1 hour
        }
    },
    version: {
        type: String,
        default: '1.0.0'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Ensure only one settings document exists
systemSettingsSchema.pre('save', async function(next) {
    const count = await this.constructor.countDocuments();
    if (count > 0 && !this._id) {
        next(new Error('Only one settings document can exist'));
    }
    this.lastUpdated = new Date();
    next();
});

// Clear cache on settings update
systemSettingsSchema.post('save', async function() {
    try {
        await cache.del('system:settings');
    } catch (error) {
        logger.error(`Failed to clear settings cache: ${error}`);
    }
});

// Static methods
systemSettingsSchema.statics.getSettings = async function() {
    try {
        // Try to get from cache first
        const cachedSettings = await cache.get('system:settings');
        if (cachedSettings) {
            return JSON.parse(cachedSettings);
        }

        // Get from database
        let settings = await this.findOne();
        if (!settings) {
            settings = await this.create({});
        }

        // Cache settings
        await cache.set('system:settings', JSON.stringify(settings), 3600);

        return settings;
    } catch (error) {
        logger.error(`Failed to get system settings: ${error}`);
        throw error;
    }
};

systemSettingsSchema.statics.updateSettings = async function(updates, userId) {
    try {
        const settings = await this.findOne();
        if (!settings) {
            return this.create({ ...updates, updatedBy: userId });
        }

        Object.assign(settings, updates);
        settings.updatedBy = userId;
        await settings.save();

        return settings;
    } catch (error) {
        logger.error(`Failed to update system settings: ${error}`);
        throw error;
    }
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = { SystemSettings }; 