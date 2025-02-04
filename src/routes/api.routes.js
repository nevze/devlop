const express = require('express');
const router = express.Router();
const { authMiddleware, apiKeyAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body } = require('express-validator');

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API is running'
    });
});

// Protected routes example
router.get('/protected', authMiddleware, (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'You have access to this protected route',
        user: req.user
    });
});

// API key protected route example
router.get('/api-protected', apiKeyAuth, (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'You have access to this API protected route',
        user: req.user
    });
});

// Example of a route with validation
router.post('/example', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    validateRequest
], (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Valid data received',
        data: req.body
    });
});

module.exports = router; 