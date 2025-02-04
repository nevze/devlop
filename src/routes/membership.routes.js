const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { body } = require('express-validator');

// Get available plans
router.get('/plans', async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            plans: [
                {
                    id: 'free',
                    name: 'Free',
                    price: 0,
                    features: ['Basic API access', '100 requests/day', 'Community support']
                },
                {
                    id: 'basic',
                    name: 'Basic',
                    price: 9.99,
                    features: ['Extended API access', '1000 requests/day', 'Email support']
                },
                {
                    id: 'pro',
                    name: 'Pro',
                    price: 29.99,
                    features: ['Full API access', 'Unlimited requests', 'Priority support', 'Custom integration']
                },
                {
                    id: 'enterprise',
                    name: 'Enterprise',
                    price: null,
                    features: ['All Pro features', 'Dedicated support', 'Custom solutions', 'SLA guarantee']
                }
            ]
        }
    });
});

// Get current subscription
router.get('/subscription', authMiddleware, async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            subscription: {
                plan: req.user.tier,
                status: 'active',
                nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        }
    });
});

// Subscribe to a plan
router.post('/subscribe', [
    authMiddleware,
    body('planId').trim().notEmpty().withMessage('Plan ID is required'),
    validateRequest
], async (req, res) => {
    const { planId } = req.body;
    
    // Validate plan exists
    const validPlans = ['free', 'basic', 'pro', 'enterprise'];
    if (!validPlans.includes(planId)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid plan selected'
        });
    }

    // Update user's plan
    req.user.tier = planId.toUpperCase();
    await req.user.save();

    res.status(200).json({
        status: 'success',
        message: 'Successfully subscribed to plan',
        data: {
            plan: req.user.tier
        }
    });
});

// Cancel subscription
router.post('/cancel', authMiddleware, async (req, res) => {
    // Set user back to free tier at end of billing period
    req.user.tier = 'FREE';
    await req.user.save();

    res.status(200).json({
        status: 'success',
        message: 'Subscription cancelled successfully'
    });
});

// Get billing history
router.get('/billing-history', authMiddleware, async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            billingHistory: [] // This would be populated from your payment processor
        }
    });
});

// Get usage statistics
router.get('/usage', authMiddleware, async (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            usage: {
                apiCalls: 0,
                bandwidth: 0,
                period: {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: new Date()
                }
            }
        }
    });
});

module.exports = router; 