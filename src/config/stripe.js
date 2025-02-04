const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('./logger');

// Configure Stripe
stripe.setApiVersion('2023-10-16');

// Stripe webhook handler
const handleWebhook = async (event) => {
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionChange(event.data.object);
                break;
            
            case 'customer.subscription.deleted':
                await handleSubscriptionCancellation(event.data.object);
                break;
            
            case 'invoice.payment_succeeded':
                await handleSuccessfulPayment(event.data.object);
                break;
            
            case 'invoice.payment_failed':
                await handleFailedPayment(event.data.object);
                break;
            
            default:
                logger.info(`Unhandled Stripe event type: ${event.type}`);
        }
    } catch (error) {
        logger.error('Stripe webhook error:', error);
        throw error;
    }
};

// Create customer
const createCustomer = async ({ email, name, metadata = {} }) => {
    try {
        const customer = await stripe.customers.create({
            email,
            name,
            metadata
        });
        
        logger.info(`Stripe customer created: ${customer.id}`);
        return customer;
    } catch (error) {
        logger.error('Error creating Stripe customer:', error);
        throw error;
    }
};

// Create subscription
const createSubscription = async ({ customerId, priceId, metadata = {} }) => {
    try {
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            metadata,
            expand: ['latest_invoice.payment_intent']
        });
        
        logger.info(`Stripe subscription created: ${subscription.id}`);
        return subscription;
    } catch (error) {
        logger.error('Error creating Stripe subscription:', error);
        throw error;
    }
};

// Update subscription
const updateSubscription = async (subscriptionId, { priceId, metadata = {} }) => {
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
                id: subscription.items.data[0].id,
                price: priceId
            }],
            metadata,
            proration_behavior: 'always_invoice'
        });
        
        logger.info(`Stripe subscription updated: ${updatedSubscription.id}`);
        return updatedSubscription;
    } catch (error) {
        logger.error('Error updating Stripe subscription:', error);
        throw error;
    }
};

// Cancel subscription
const cancelSubscription = async (subscriptionId) => {
    try {
        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        logger.info(`Stripe subscription cancelled: ${subscription.id}`);
        return subscription;
    } catch (error) {
        logger.error('Error cancelling Stripe subscription:', error);
        throw error;
    }
};

// Create payment intent
const createPaymentIntent = async ({ amount, currency, customerId, metadata = {} }) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            customer: customerId,
            metadata,
            automatic_payment_methods: {
                enabled: true
            }
        });
        
        logger.info(`Stripe payment intent created: ${paymentIntent.id}`);
        return paymentIntent;
    } catch (error) {
        logger.error('Error creating Stripe payment intent:', error);
        throw error;
    }
};

// Retrieve invoice
const retrieveInvoice = async (invoiceId) => {
    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        return invoice;
    } catch (error) {
        logger.error('Error retrieving Stripe invoice:', error);
        throw error;
    }
};

// Get subscription usage
const getSubscriptionUsage = async (subscriptionItemId, { startDate, endDate }) => {
    try {
        const usage = await stripe.subscriptionItems.listUsageRecordSummaries(
            subscriptionItemId,
            {
                limit: 100,
                start_date: startDate,
                end_date: endDate
            }
        );
        return usage;
    } catch (error) {
        logger.error('Error retrieving Stripe subscription usage:', error);
        throw error;
    }
};

module.exports = {
    stripe,
    handleWebhook,
    createCustomer,
    createSubscription,
    updateSubscription,
    cancelSubscription,
    createPaymentIntent,
    retrieveInvoice,
    getSubscriptionUsage
}; 