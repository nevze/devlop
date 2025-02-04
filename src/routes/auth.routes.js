const express = require('express');
const { body } = require('express-validator');
const { authMiddleware, authRateLimiter } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const {
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
} = require('../controllers/auth.controller');

const router = express.Router();

// Registration
router.post(
    '/register',
    authRateLimiter,
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
    ],
    validateRequest,
    register
);

// Login
router.post(
    '/login',
    authRateLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    validateRequest,
    login
);

// Logout
router.post('/logout', authMiddleware, logout);

// Token refresh
router.post(
    '/refresh-token',
    [
        body('refreshToken').notEmpty().withMessage('Refresh token is required')
    ],
    validateRequest,
    refreshToken
);

// Password reset
router.post(
    '/forgot-password',
    authRateLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
    ],
    validateRequest,
    forgotPassword
);

router.post(
    '/reset-password/:token',
    authRateLimiter,
    [
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
    ],
    validateRequest,
    resetPassword
);

// Email verification
router.get('/verify-email/:token', verifyEmail);

router.post(
    '/resend-verification',
    authRateLimiter,
    authMiddleware,
    resendVerificationEmail
);

// Google OAuth
router.post(
    '/google',
    authRateLimiter,
    [
        body('idToken').notEmpty().withMessage('ID token is required')
    ],
    validateRequest,
    googleAuth
);

// Change password
router.post(
    '/change-password',
    authMiddleware,
    [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long')
            .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character')
    ],
    validateRequest,
    changePassword
);

module.exports = router; 