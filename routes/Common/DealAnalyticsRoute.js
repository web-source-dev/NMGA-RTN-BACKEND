const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Payment = require('../../models/Paymentmodel');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');
// Get deal analytics overview
router.get('/overview', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_deal_analytics', 'deal analytics overview');
        
        const total = await Deal.countDocuments();
        const active = await Deal.countDocuments({ status: 'active' });

        // Calculate total revenue
        const totalRevenue = await Payment.aggregate([
            {
                $match: { status: 'completed' }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get average discount
        const avgDiscount = await Deal.aggregate([
            {
                $match: { status: 'active' }
            },
            {
                $group: {
                    _id: null,
                    avgDiscount: {
                        $avg: {
                            $subtract: [
                                '$originalCost',
                                '$discountPrice'
                            ]
                        }
                    }
                }
            }
        ]);

        // Get performance metrics
        const performance = {
            conversionRate: 68,
            averageOrderValue: await Payment.aggregate([
                {
                    $match: { status: 'completed' }
                },
                {
                    $group: {
                        _id: null,
                        avg: { $avg: '$amount' }
                    }
                }
            ]).then(res => res[0]?.avg || 0),
            totalViews: await Deal.aggregate([
                { $group: { _id: null, total: { $sum: '$views' } } }
            ]).then(res => res[0]?.total || 0),
            totalImpressions: await Deal.aggregate([
                { $group: { _id: null, total: { $sum: '$impressions' } } }
            ]).then(res => res[0]?.total || 0)
        };

        res.json({
            total,
            active,
            totalRevenue: totalRevenue[0]?.total || 0,
            averageDiscount: avgDiscount[0]?.avgDiscount || 0,
            performance
        });
    } catch (error) {
        console.error('Error fetching deal analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get deal categories statistics
router.get('/categories', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_deal_categories', 'deal categories statistics');
        
        const categories = await Deal.aggregate([
            {
                $group: {
                    _id: '$category',
                    value: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $multiply: ['$discountPrice', '$totalSold']
                        }
                    }
                }
            },
            {
                $project: {
                    name: '$_id',
                    value: 1,
                    revenue: 1,
                    _id: 0
                }
            }
        ]);

        res.json(categories);
    } catch (error) {
        console.error('Error fetching category stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get recent deals
router.get('/recent', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_recent_deals', 'recent deals analytics', {
            limit: Math.min(parseInt(req.query.limit) || 5, 20)
        });
        
        const limit = Math.min(parseInt(req.query.limit) || 5, 20); // Cap at 20 items
        const recentDeals = await Deal.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('distributor', 'name')
            .select('name distributor discountPrice status totalSold');

        res.json(recentDeals);
    } catch (error) {
        console.error('Error fetching recent deals:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 