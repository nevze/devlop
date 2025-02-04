const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
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
const { authMiddleware } = require('../middleware/auth.middleware');

// Register
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain a number')
        .matches(/[A-Z]/)
        .withMessage('Password must contain an uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain a lowercase letter')
        .matches(/[!@#$%^&*]/)
        .withMessage('Password must contain a special character'),
    validateRequest
], register);

// Login
router.post('/login', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
], login);

// Logout
router.post('/logout', authMiddleware, logout);

// Refresh token
router.post('/refresh-token', refreshToken);

// Forgot password
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Please provide a valid email'),
    validateRequest
], forgotPassword);

// Reset password
router.post('/reset-password/:token', [
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain a number')
        .matches(/[A-Z]/)
        .withMessage('Password must contain an uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain a lowercase letter')
        .matches(/[!@#$%^&*]/)
        .withMessage('Password must contain a special character'),
    validateRequest
], resetPassword);

// Email verification
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authMiddleware, resendVerificationEmail);

// Google authentication
router.post('/google', googleAuth);

// Change password
router.post('/change-password', [
    authMiddleware,
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/\d/)
        .withMessage('Password must contain a number')
        .matches(/[A-Z]/)
        .withMessage('Password must contain an uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain a lowercase letter')
        .matches(/[!@#$%^&*]/)
        .withMessage('Password must contain a special character'),
    validateRequest
], changePassword);

module.exports = router; 