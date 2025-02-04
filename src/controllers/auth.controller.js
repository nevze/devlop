const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user.model');
const { AppError } = require('../middleware/error.middleware');
const { verifyFirebaseToken } = require('../config/firebase');
const { sendEmail } = require('../utils/email');
const logger = require('../config/logger');
const { cache } = require('../config/redis');

// Register new user
const register = async (req, res) => {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new AppError('Email already registered', 400);
    }

    // Create user
    const user = await User.create({
        name,
        email,
        password
    });

    // Generate verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    // Send verification email
    try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendEmail({
            to: user.email,
            subject: 'Please verify your email',
            template: 'emailVerification',
            context: {
                name: user.name,
                verificationUrl
            }
        });
    } catch (error) {
        logger.error(`Failed to send verification email: ${error}`);
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
    }

    // Generate tokens
    const token = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    res.status(201).json({
        status: 'success',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token,
            refreshToken
        }
    });
};

// Login user
const login = async (req, res) => {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const token = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    res.status(200).json({
        status: 'success',
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token,
            refreshToken
        }
    });
};

// Logout user
const logout = async (req, res) => {
    // In a real implementation, you might want to invalidate the token
    // This could be done by adding it to a blacklist in Redis
    res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
    });
};

// Refresh token
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            throw new AppError('User not found', 404);
        }

        const newToken = user.generateJWT();
        const newRefreshToken = user.generateRefreshToken();

        res.status(200).json({
            status: 'success',
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });
    } catch (error) {
        throw new AppError('Invalid refresh token', 401);
    }
};

// Forgot password
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        throw new AppError('No user found with this email', 404);
    }

    const resetToken = user.createPasswordResetToken();
    await user.save();

    try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        await sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            template: 'passwordReset',
            context: {
                name: user.name,
                resetUrl
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'Password reset link sent to email'
        });
    } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        throw new AppError('Error sending password reset email', 500);
    }
};

// Reset password
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const jwtToken = user.generateJWT();
    const refreshToken = user.generateRefreshToken();

    res.status(200).json({
        status: 'success',
        data: {
            token: jwtToken,
            refreshToken
        }
    });
};

// Verify email
const verifyEmail = async (req, res) => {
    const { token } = req.params;

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new AppError('Invalid or expired verification token', 400);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
        status: 'success',
        message: 'Email verified successfully'
    });
};

// Resend verification email
const resendVerificationEmail = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.isEmailVerified) {
        throw new AppError('Email already verified', 400);
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendEmail({
            to: user.email,
            subject: 'Please verify your email',
            template: 'emailVerification',
            context: {
                name: user.name,
                verificationUrl
            }
        });

        res.status(200).json({
            status: 'success',
            message: 'Verification email sent'
        });
    } catch (error) {
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        throw new AppError('Error sending verification email', 500);
    }
};

// Change password
const changePassword = async (req, res) => {
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

// Google authentication
const googleAuth = async (req, res) => {
    const { idToken } = req.body;

    try {
        const decodedToken = await verifyFirebaseToken(idToken);
        
        let user = await User.findOne({ email: decodedToken.email });

        if (!user) {
            // Create new user
            user = await User.create({
                name: decodedToken.name || decodedToken.email.split('@')[0],
                email: decodedToken.email,
                password: crypto.randomBytes(20).toString('hex'),
                firebaseUid: decodedToken.uid,
                isEmailVerified: decodedToken.email_verified
            });
        } else {
            // Update existing user
            user.firebaseUid = decodedToken.uid;
            user.isEmailVerified = decodedToken.email_verified;
            await user.save();
        }

        const token = user.generateJWT();
        const refreshToken = user.generateRefreshToken();

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token,
                refreshToken
            }
        });
    } catch (error) {
        throw new AppError('Google authentication failed', 401);
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    googleAuth,
    changePassword
}; 