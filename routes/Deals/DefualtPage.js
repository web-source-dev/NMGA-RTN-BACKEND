const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const mongoose = require('mongoose');

// Get dashboard statistics for distributor
router.get('/dashboard-stats/:distributorId', async (req, res) => {
    try {
        const { distributorId } = req.params;
        const objectId = new mongoose.Types.ObjectId(distributorId);

        // Get total active deals
        const activeDeals = await Deal.countDocuments({ 
            distributor: objectId,
            status: 'active'
        });

        // Get total sales amount and other metrics
        const dealMetrics = await Deal.aggregate([
            { 
                $match: { 
                    distributor: objectId 
                }
            },
            { 
                $group: { 
                    _id: null,
                    totalSales: { $sum: "$totalRevenue" },
                    totalViews: { $sum: "$views" },
                    totalImpressions: { $sum: "$impressions" }
                }
            }
        ]);

        // Get monthly sales data for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlySales = await Deal.aggregate([
            {
                $match: {
                    distributor: objectId,
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    sales: { $sum: "$totalRevenue" },
                    views: { $sum: "$views" },
                    totalSold: { $sum: "$totalSold" },
                    impressions: { $sum: "$impressions" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Get category distribution
        const categoryDistribution = await Deal.aggregate([
            { 
                $match: { 
                    distributor: objectId
                }
            },
            {
                $group: {
                    _id: { $ifNull: ["$category", "Uncategorized"] },
                    value: { $sum: 1 }
                }
            },
            {
                $project: {
                    name: "$_id",
                    value: 1,
                    _id: 0
                }
            }
        ]);

        // Get pending commitments
        const pendingCommitments = await Commitment.countDocuments({
            dealId: { 
                $in: await Deal.find({ distributor: objectId }).distinct('_id') 
            },
            status: 'pending'
        });

        // Get recent deals with complete information
        const recentDeals = await Deal.find({ distributor: objectId })
            .select('name discountPrice status createdAt totalRevenue totalSold')
            .sort({ createdAt: -1 })
            .limit(5);

        // Get recent commitments with populated data
        const recentCommitments = await Commitment.find({
            dealId: { 
                $in: await Deal.find({ distributor: objectId }).distinct('_id') 
            }
        })
        .populate('userId', 'name businessName contactPerson phone role')
        .populate('dealId', 'name discountPrice')
        .select('userId dealId totalPrice status createdAt quantity modifiedQuantity modifiedTotalPrice paymentStatus')
        .sort({ createdAt: -1 })
        .limit(5);

        // Transform monthly sales data for chart
        const salesData = monthlySales.map(item => ({
            month: new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'short' }),
            sales: item.sales || 0,
            views: item.views || 0,
            totalSold: item.totalSold || 0,
            impressions: item.impressions || 0
        }));

        res.json({
            activeDeals,
            totalSales: dealMetrics[0]?.totalSales || 0,
            totalViews: dealMetrics[0]?.totalViews || 0,
            totalImpressions: dealMetrics[0]?.totalImpressions || 0,
            pendingCommitments,
            salesData,
            categoryDistribution,
            recentDeals: recentDeals.map(deal => ({
                _id: deal._id,
                name: deal.name,
                discountPrice: deal.discountPrice,
                status: deal.status,
                createdAt: deal.createdAt,
                totalSold: deal.totalSold,
                totalRevenue: deal.totalRevenue
            })),
            recentCommitments: recentCommitments.map(commit => ({
                _id: commit._id,
                userName: commit.userId?.name || commit.userId?.businessName || commit.userId?.contactPerson || 'N/A',
                dealName: commit.dealId?.name || 'N/A',
                totalPrice: commit.modifiedTotalPrice || commit.totalPrice,
                quantity: commit.modifiedQuantity || commit.quantity,
                status: commit.status,
                createdAt: commit.createdAt,
                userRole: commit.userId?.role || 'N/A',
                userContact: commit.userId?.phone || 'N/A',
                paymentStatus: commit.paymentStatus || 'pending'
            }))
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: "Error fetching dashboard statistics", error: error.message });
    }
});

module.exports = router;
