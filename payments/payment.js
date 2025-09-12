const express = require('express');
const router = express.Router();
const Payment = require('../models/Paymentmodel');
const Commitment = require('../models/Commitments');
const Deal = require('../models/Deals');
const User = require('../models/User');
// Add error handling for Stripe initialization
let stripe;
try {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully in test mode');
} catch (error) {
    console.error('Stripe initialization error:', error);
    stripe = {
        paymentIntents: {
            create: () => Promise.reject(new Error('Stripe is not properly configured')),
            update: () => Promise.reject(new Error('Stripe is not properly configured'))
        }
    };
}

// Validation middleware
const validatePaymentRequest = (req, res, next) => {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ 
            error: 'Invalid amount. Please provide a valid positive number.' 
        });
    }
    next();
};

// Stripe payment endpoint
router.post('/create-stripe-payment', validatePaymentRequest, async (req, res) => {
    try {
        if (!stripe.paymentIntents) {
            throw new Error('Stripe is not properly initialized');
        }

        const { amount, currency = 'usd', commitmentId, userDetails } = req.body;

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            metadata: {
                commitmentId,
                customerName: userDetails?.name,
                customerEmail: userDetails?.email
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Fetch commitment details with populated references
        const commitment = await Commitment.findById(commitmentId)
            .populate('dealId')
            .populate('userId')
            .populate({
                path: 'dealId',
                populate: {
                    path: 'distributor'
                }
            });

        if (!notificationSent) {
            console.warn('Failed to send payment notifications');
        }

        // Create payment record
        const payment = await Payment.create({
            commitmentId: commitment._id,
            userId: commitment.userId._id,
            dealId: commitment.dealId._id,
            amount: amount,
            paymentMethod: 'stripe',
            transactionId: paymentIntent.id,
            status: 'completed'
        });

        // Update commitment status
        await Commitment.findByIdAndUpdate(commitmentId, {
            paymentStatus: 'paid',
            status: 'completed'
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            success: true,
            payment: payment
        });

    } catch (error) {
        console.error('Stripe payment error:', error);

        res.status(500).json({ 
            error: 'An error occurred while processing your payment.',
            details: error.message 
        });
    }
});

// Add this endpoint to handle payment creation and update commitment status
router.post('/create', async (req, res) => {
    try {
        const { 
            commitmentId, 
            userId, 
            dealId, 
            amount, 
            paymentMethod, 
            transactionId, 
            paymentDetails,
            billingDetails 
        } = req.body;

        // Validate required fields
        if (!commitmentId || !userId || !dealId || !amount || !paymentMethod || !transactionId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Create new payment record
        const payment = new Payment({
            commitmentId,
            userId,
            dealId,
            amount,
            paymentMethod,
            transactionId,
            paymentDetails,
            billingDetails,
            status: 'completed'
        });

        await payment.save();

        // Update commitment status
        await Commitment.findByIdAndUpdate(commitmentId, {
            paymentStatus: 'paid',
            status: 'completed'
        });

        // Update deal's sold quantity and total price
        const commitment = await Commitment.findById(commitmentId);
        if (commitment) {
            await Deal.findByIdAndUpdate(dealId, {
                $inc: {
                    totalSold: commitment.modifiedQuantity || commitment.quantity,
                    totalPriceSold: amount
                }
            });
        }

        res.json({ 
            success: true, 
            payment,
            message: 'Payment processed successfully'
        });
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ 
            error: 'Error processing payment',
            details: error.message 
        });
    }
});

// Add route to get payment history
router.get('/history/:userId', async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.params.userId })
            .populate('dealId')
            .populate('commitmentId')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching payment history' });
    }
});

// Add this new route to get checkout data
router.get('/checkout-data/:commitmentId', async (req, res) => {
    try {
        const { commitmentId } = req.params;
        const { userId } = req.query;

        // Fetch commitment with related data
        const commitment = await Commitment.findById(commitmentId)
            .populate('dealId')
            .populate('userId');

        if (!commitment) {
            return res.status(404).json({ message: 'Commitment not found' });
        }

        // Verify the user making the request is the commitment owner
        if (commitment.userId._id.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Fetch distributor details
        const distributor = await User.findById(commitment.dealId.distributor);

        // Prepare and send the response
        res.json({
            commitment,
            deal: commitment.dealId,
            distributor: {
                businessName: distributor.businessName,
                phone: distributor.phone,
                email: distributor.email
            },
            user: commitment.userId
        });
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        res.status(500).json({ 
            message: 'Error fetching checkout data',
            error: error.message 
        });
    }
});

module.exports = router;
