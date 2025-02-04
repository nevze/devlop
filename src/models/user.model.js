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
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    active: {
        type: Boolean,
        default: true,
        select: false
    },
    tier: {
        type: String,
        enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
        default: 'FREE'
    },
    company: String,
    website: String,
    timezone: String,
    bio: String,
    avatar: String,
    firebaseUid: String,
    stripeCustomerId: String,
    apiKeys: [apiKeySchema],
    notificationSettings: {
        email: {
            type: Boolean,
            default: true
        },
        push: {
            type: Boolean,
            default: true
        },
        usageAlerts: {
            type: Boolean,
            default: true
        },
        newsletterSubscription: {
            type: Boolean,
            default: false
        },
        marketingEmails: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual field for full profile URL
userSchema.virtual('profileUrl').get(function() {
    return `${process.env.FRONTEND_URL}/users/${this._id}`;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Only return active users
userSchema.pre(/^find/, function(next) {
    this.find({ active: { $ne: false } });
    next();
});

// Check if password is correct
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

// Generate JWT token
userSchema.methods.generateJWT = function() {
    return jwt.sign(
        { userId: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        { userId: this._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString('hex');

    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    return verificationToken;
};

// Generate API key
userSchema.methods.generateApiKey = function(name, permissions = ['read'], expiresIn = null) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    this.apiKeys.push({
        key: apiKey,
        name,
        permissions,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn) : null
    });

    return apiKey;
};

const User = mongoose.model('User', userSchema);

module.exports = {
    User
}; 