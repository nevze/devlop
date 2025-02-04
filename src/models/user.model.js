const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const apiKeySchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    },
    lastUsed: {
        type: Date
    },
    permissions: [{
        type: String,
        enum: ['read', 'write', 'admin']
    }]
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name']
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 8,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    tier: {
        type: String,
        enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
        default: 'FREE'
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    firebaseUid: {
        type: String,
        sparse: true
    },
    apiKeys: [apiKeySchema],
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    lastLogin: Date,
    active: {
        type: Boolean,
        default: true,
        select: false
    },
    subscription: {
        stripeCustomerId: String,
        stripePriceId: String,
        stripeSubscriptionId: String,
        status: {
            type: String,
            enum: ['active', 'canceled', 'past_due', 'unpaid'],
            default: 'active'
        },
        currentPeriodEnd: Date
    },
    usage: {
        apiCalls: {
            type: Number,
            default: 0
        },
        lastReset: {
            type: Date,
            default: Date.now
        },
        scrapingCredits: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.pre(/^find/, function(next) {
    this.find({ active: { $ne: false } });
    next();
});

// Methods
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
    
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    return verificationToken;
};

userSchema.methods.createApiKey = function(name, permissions = ['read'], expiresIn = null) {
    const apiKey = crypto.randomBytes(32).toString('base64url');
    
    this.apiKeys.push({
        key: apiKey,
        name,
        permissions,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null
    });
    
    return apiKey;
};

userSchema.methods.generateJWT = function() {
    return jwt.sign(
        { 
            userId: this._id,
            email: this.email,
            role: this.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        { userId: this._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );
};

const User = mongoose.model('User', userSchema);

module.exports = { User }; 