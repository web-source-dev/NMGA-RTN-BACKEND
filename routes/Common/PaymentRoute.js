const express = require('express');
const router = express.Router();
const Payment = require('../../models/Paymentmodel');
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { isAdmin } = require('../../middleware/auth');
// Get recent payments
router.get('/recent', isAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const payments = await Payment.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'name')
            .populate('dealId', 'name')
            .select('amount status createdAt userId dealId');

        const formattedPayments = payments.map(payment => ({
            _id: payment._id,
            userId: payment.userId?.name || 'Unknown User',
            dealId: payment.dealId?.name || 'Unknown Deal',
            amount: payment.amount || 0,
            status: payment.status || 'pending',
            createdAt: payment.createdAt
        }));

        res.json(formattedPayments);
    } catch (error) {
        console.error('Error fetching recent payments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get payment analytics
router.get('/analytics', isAdmin, async (req, res) => {
    try {
        const [totalStats, monthlyStats, statusStats] = await Promise.all([
            // Total payment statistics
            Payment.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$amount' },
                        totalCount: { $sum: 1 },
                        averageAmount: { $avg: '$amount' }
                    }
                }
            ]),
            // Monthly payment statistics
            Payment.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        amount: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        month: {
                            $concat: [
                                { $toString: '$_id.year' },
                                '-',
                                { $toString: '$_id.month' }
                            ]
                        },
                        amount: 1,
                        count: 1
                    }
                },
                { $sort: { month: 1 } }
            ]),
            // Payment status statistics
            Payment.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        amount: { $sum: '$amount' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        status: '$_id',
                        count: 1,
                        amount: 1
                    }
                }
            ])
        ]);

        res.json({
            total: totalStats[0] || { totalAmount: 0, totalCount: 0, averageAmount: 0 },
            monthly: monthlyStats,
            byStatus: statusStats
        });
    } catch (error) {
        console.error('Error fetching payment analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get payment details
router.get('/:id', isAdmin, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('userId', 'name email businessName')
            .populate('dealId', 'name description discountPrice');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json(payment);
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new payment
router.post('/', isAdmin, async (req, res) => {
    try {
        const { userId, dealId, amount, status } = req.body;

        // Validate user and deal exist
        const [user, deal] = await Promise.all([
            User.findById(userId),
            Deal.findById(dealId)
        ]);

        if (!user || !deal) {
            return res.status(400).json({ error: 'Invalid user or deal ID' });
        }

        const payment = new Payment({
            userId,
            dealId,
            amount,
            status: status || 'pending'
        });

        const savedPayment = await payment.save();

        // Update deal statistics if payment is completed
        if (status === 'completed') {
            await Deal.findByIdAndUpdate(dealId, {
                $inc: {
                    totalSold: 1,
                    totalRevenue: amount
                }
            });
        }

        res.status(201).json(savedPayment);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update payment status
router.put('/:id/status', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // If payment is being marked as completed
        if (status === 'completed' && payment.status !== 'completed') {
            await Deal.findByIdAndUpdate(payment.dealId, {
                $inc: {
                    totalSold: 1,
                    totalRevenue: payment.amount
                }
            });
        }
        // If payment was completed but is now being marked as something else
        else if (payment.status === 'completed' && status !== 'completed') {
            await Deal.findByIdAndUpdate(payment.dealId, {
                $inc: {
                    totalSold: -1,
                    totalRevenue: -payment.amount
                }
            });
        }

        payment.status = status;
        const updatedPayment = await payment.save();

        res.json(updatedPayment);
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 