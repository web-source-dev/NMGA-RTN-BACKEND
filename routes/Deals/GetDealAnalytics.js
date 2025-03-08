const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
const mongoose = require('mongoose');

// Get analytics for a specific deal
router.get('/:dealId', async (req, res) => {
    try {
        const { dealId } = req.params;
        const userRole = req.query.userRole;
        const distributorId = req.query.distributorId;

        // Check if user has permission to view analytics
        if (userRole !== 'admin' && userRole !== 'distributor') {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // If distributor, check if they own the deal
        if (userRole === 'distributor') {
            const deal = await Deal.findOne({ _id: dealId, distributor: distributorId });
            if (!deal) {
                return res.status(403).json({ message: 'Unauthorized access to this deal' });
            }
        }

        // Get deal details
        const deal = await Deal.findById(dealId).populate('distributor', 'businessName name');

        // Get all commitments for the deal
        const commitments = await Commitment.find({ dealId })
            .populate('userId', 'businessName name')
            .sort({ createdAt: -1 });

        // Calculate analytics data
        const totalCommitments = commitments.length;
        const totalQuantity = commitments.reduce((sum, c) => sum + c.quantity, 0);
        const totalRevenue = commitments.reduce((sum, c) => sum + c.totalPrice, 0);

        // Status breakdown
        const statusBreakdown = commitments.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {});

        // Last 7 days hourly data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Generate default 7-day structure
        const defaultDays = [...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        const hourlyData = await Commitment.aggregate([
            {
                $match: {
                    dealId: new mongoose.Types.ObjectId(dealId),
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        hour: { $hour: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    totalValue: { $sum: "$totalPrice" },
                    uniqueMembers: { $addToSet: "$userId" }
                }
            },
            { $sort: { "_id.day": 1, "_id.hour": 1 } }
        ]);

        // Create a complete hourly activity dataset with default values
        const completeHourlyActivity = defaultDays.map(day => ({
            day,
            hours: [...Array(24)].map((_, hour) => {
                const existingData = hourlyData.find(d => 
                    d._id.day === day && d._id.hour === hour
                );
                return {
                    hour,
                    count: existingData?.count || 0,
                    quantity: existingData?.totalQuantity || 0,
                    value: existingData?.totalValue || 0,
                    uniqueMembers: existingData?.uniqueMembers?.length || 0
                };
            })
        }));

        // Daily performance metrics
        const dailyMetrics = await Commitment.aggregate([
            {
                $match: {
                    dealId: new mongoose.Types.ObjectId(dealId),
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalOrders: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    totalRevenue: { $sum: "$totalPrice" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    maxOrderValue: { $max: "$totalPrice" },
                    minOrderValue: { $min: "$totalPrice" },
                    uniqueMembers: { $addToSet: "$userId" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Member analysis
        const memberAnalysis = await Commitment.aggregate([
            { $match: { dealId: new mongoose.Types.ObjectId(dealId) } },
            {
                $group: {
                    _id: "$userId",
                    totalCommitments: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    totalValue: { $sum: "$totalPrice" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    avgQuantityPerOrder: { $avg: "$quantity" },
                    maxQuantity: { $max: "$quantity" },
                    minQuantity: { $min: "$quantity" },
                    lastOrderDate: { $max: "$createdAt" },
                    firstOrderDate: { $min: "$createdAt" },
                    orderDates: { $push: "$createdAt" },
                    quantities: { $push: "$quantity" },
                    values: { $push: "$totalPrice" }
                }
            },
            { $sort: { totalQuantity: -1 } }
        ]);

        const populatedMembers = await User.populate(memberAnalysis, {
            path: "_id",
            select: "businessName name"
        });

        // Quantity segments
        const quantitySegments = await Commitment.aggregate([
            { $match: { dealId: new mongoose.Types.ObjectId(dealId) } },
            {
                $bucket: {
                    groupBy: "$quantity",
                    boundaries: [0, 50, 100, 500, 1000, Infinity],
                    default: "1000+",
                    output: {
                        count: { $sum: 1 },
                        totalValue: { $sum: "$totalPrice" },
                        avgValue: { $avg: "$totalPrice" },
                        members: { $addToSet: "$userId" },
                        totalQuantity: { $sum: "$quantity" }
                    }
                }
            }
        ]);

        // Performance metrics
        const performanceMetrics = {
            peakHourOrders: Math.max(...hourlyData.map(h => h.count)),
            peakDayOrders: Math.max(...dailyMetrics.map(d => d.totalOrders)),
            averageDailyOrders: dailyMetrics.reduce((sum, d) => sum + d.totalOrders, 0) / dailyMetrics.length || 0,
            totalUniqueMembers: new Set(commitments.map(c => c.userId.toString())).size,
            repeatOrderRate: (commitments.length - new Set(commitments.map(c => c.userId.toString())).size) / commitments.length * 100,
            avgTimeToNextOrder: calculateAvgTimeBetweenOrders(commitments),
            orderCompletionRate: (commitments.filter(c => c.status === 'approved').length / commitments.length) * 100
        };

        // Format response
        const analyticsData = {
            dealInfo: {
                name: deal.name,
                category: deal.category,
                distributor: deal.distributor.businessName || deal.distributor.name,
                originalCost: deal.originalCost,
                discountPrice: deal.discountPrice,
                minQtyForDiscount: deal.minQtyForDiscount,
                views: deal.views || 0,
                impressions: deal.impressions || 0,
                conversionRate: deal.views ? ((totalCommitments / deal.views) * 100).toFixed(2) : 0,
                dealProgress: calculateDealProgress(deal)
            },
            overview: {
                totalCommitments,
                totalQuantity,
                totalRevenue,
                averageOrderValue: totalCommitments ? (totalRevenue / totalCommitments) : 0,
                averageQuantityPerOrder: totalCommitments ? (totalQuantity / totalCommitments) : 0,
                ...performanceMetrics
            },
            statusBreakdown,
            hourlyActivity: completeHourlyActivity,
            dailyPerformance: defaultDays.map(day => {
                const metrics = dailyMetrics.find(d => d._id === day) || {
                    totalOrders: 0,
                    totalQuantity: 0,
                    totalRevenue: 0,
                    avgOrderValue: 0,
                    maxOrderValue: 0,
                    minOrderValue: 0,
                    uniqueMembers: []
                };
                return {
                    date: day,
                    totalOrders: metrics.totalOrders || 0,
                    totalQuantity: metrics.totalQuantity || 0,
                    totalRevenue: metrics.totalRevenue || 0,
                    avgOrderValue: metrics.avgOrderValue || 0,
                    maxOrderValue: metrics.maxOrderValue || 0,
                    minOrderValue: metrics.minOrderValue || 0,
                    uniqueMemberCount: metrics.uniqueMembers?.length || 0
                };
            }),
            memberInsights: {
                topMembers: populatedMembers.slice(0, 5).map(member => ({
                    name: member._id.businessName || member._id.name,
                    ...member,
                    orderHistory: member.orderDates.map((date, i) => ({
                        date,
                        quantity: member.quantities[i],
                        value: member.values[i]
                    })),
                    _id: undefined,
                    orderDates: undefined,
                    quantities: undefined,
                    values: undefined
                })),
                bottomMembers: populatedMembers.slice(-5).map(member => ({
                    name: member._id.businessName || member._id.name,
                    ...member,
                    _id: undefined
                })),
                quantitySegments: quantitySegments.map(segment => ({
                    range: segment._id === "1000+" ? "1000+" : `${segment._id}-${segment._id + 1}`,
                    count: segment.count,
                    totalValue: segment.totalValue,
                    avgValue: segment.avgValue,
                    totalQuantity: segment.totalQuantity,
                    memberCount: segment.members.length
                }))
            }
        };

        res.json(analyticsData);
    } catch (error) {
        console.error('Error fetching deal analytics:', error);
        res.status(500).json({ message: 'Error fetching deal analytics' });
    }
});

function calculateAvgTimeBetweenOrders(commitments) {
    if (commitments.length < 2) return 0;
    
    const sortedCommitments = commitments.sort((a, b) => a.createdAt - b.createdAt);
    let totalTime = 0;
    let count = 0;
    
    for (let i = 1; i < sortedCommitments.length; i++) {
        const timeDiff = sortedCommitments[i].createdAt - sortedCommitments[i-1].createdAt;
        totalTime += timeDiff;
        count++;
    }
    
    return count > 0 ? totalTime / count / (1000 * 60 * 60) : 0; // Convert to hours
}

function calculateDealProgress(deal) {
    if (!deal.dealEndsAt) return 100;
    
    const now = new Date();
    const endDate = new Date(deal.dealEndsAt);
    const startDate = new Date(deal.createdAt);
    
    const totalDuration = endDate - startDate;
    const elapsed = now - startDate;
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

module.exports = router;

