const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Deal = require('../../models/Deals');
const Payment = require('../../models/Paymentmodel');

// Get analytics overview
router.get('/overview', async (req, res) => {
    try {
        const [userStats, dealStats, paymentStats] = await Promise.all([
            // User statistics
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: 1 },
                        activeUsers: {
                            $sum: { $cond: [{ $eq: ['$isBlocked', false] }, 1, 0] }
                        }
                    }
                }
            ]),
            // Deal statistics
            Deal.aggregate([
                {
                    $group: {
                        _id: null,
                        totalDeals: { $sum: 1 },
                        activeDeals: {
                            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                        },
                        totalViews: { $sum: '$views' },
                        totalImpressions: { $sum: '$impressions' }
                    }
                }
            ]),
            // Payment statistics
            Payment.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$amount' },
                        averageTransaction: { $avg: '$amount' },
                        totalTransactions: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            users: userStats[0] || { totalUsers: 0, activeUsers: 0 },
            deals: dealStats[0] || { totalDeals: 0, activeDeals: 0, totalViews: 0, totalImpressions: 0 },
            payments: paymentStats[0] || { totalRevenue: 0, averageTransaction: 0, totalTransactions: 0 }
        });
    } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get weekly metrics
router.get('/weekly-metrics', async (req, res) => {
    try {
        // Get data for the last 7 weeks
        const sevenWeeksAgo = new Date();
        sevenWeeksAgo.setDate(sevenWeeksAgo.getDate() - (7 * 7));

        const weeklyData = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: sevenWeeksAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        week: { $week: '$createdAt' }
                    },
                    revenue: { $sum: '$amount' },
                    deals: { $addToSet: '$dealId' },
                    users: { $addToSet: '$userId' }
                }
            },
            {
                $project: {
                    _id: 0,
                    week: {
                        $concat: [
                            'Week ',
                            { $toString: '$_id.week' }
                        ]
                    },
                    revenue: 1,
                    deals: { $size: '$deals' },
                    users: { $size: '$users' }
                }
            },
            { $sort: { '_id.year': 1, '_id.week': 1 } }
        ]);

        res.json(weeklyData);
    } catch (error) {
        console.error('Error fetching weekly metrics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get regional statistics
router.get('/regions', async (req, res) => {
    try {
        const regions = await User.aggregate([
            {
                $match: {
                    address: { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$region',
                    users: { $sum: 1 },
                    businesses: {
                        $sum: {
                            $cond: [{ $ne: ['$businessName', null] }, 1, 0]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'deals',
                    localField: '_id',
                    foreignField: 'region',
                    as: 'deals'
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    users: 1,
                    deals: { $size: '$deals' },
                    businesses: 1
                }
            }
        ]);

        res.json(regions);
    } catch (error) {
        console.error('Error fetching regional statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get business type statistics
router.get('/business-types', async (req, res) => {
    try {
        const businessTypes = await User.aggregate([
            {
                $match: {
                    businessType: { $exists: true, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$businessType',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'businessType',
                    as: 'payments'
                }
            },
            {
                $project: {
                    _id: 0,
                    type: '$_id',
                    count: 1,
                    revenue: {
                        $sum: '$payments.amount'
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json(businessTypes);
    } catch (error) {
        console.error('Error fetching business type statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 