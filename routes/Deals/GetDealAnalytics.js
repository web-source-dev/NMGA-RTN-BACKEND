const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
const mongoose = require('mongoose');

// Helper function to calculate total quantity for a commitment
const calculateTotalQuantity = (commitment) => {
    // If sizeCommitments exists and has items, sum all sizes
    if (commitment.sizeCommitments && commitment.sizeCommitments.length > 0) {
        return commitment.sizeCommitments.reduce((sum, item) => sum + item.quantity, 0);
    }
    // Otherwise, use the regular quantity field (or 0 if it doesn't exist)
    return commitment.quantity || 0;
};

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

        // Calculate analytics data using the helper function for quantities
        const totalCommitments = commitments.length;
        const totalQuantity = commitments.reduce((sum, c) => sum + calculateTotalQuantity(c), 0);
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

        // Modified aggregation to handle size-based commitments
        const hourlyData = await Commitment.aggregate([
            {
                $match: {
                    dealId: new mongoose.Types.ObjectId(dealId),
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $addFields: {
                    // Calculate quantity from sizeCommitments or use regular quantity
                    calculatedQuantity: {
                        $cond: {
                            if: { $isArray: "$sizeCommitments" },
                            then: {
                                $reduce: {
                                    input: "$sizeCommitments",
                                    initialValue: 0,
                                    in: { $add: ["$$value", "$$this.quantity"] }
                                }
                            },
                            else: { $ifNull: ["$quantity", 0] }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        hour: { $hour: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    totalQuantity: { $sum: "$calculatedQuantity" },
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

        // Daily performance metrics with handling for size-based commitments
        const dailyMetrics = await Commitment.aggregate([
            {
                $match: {
                    dealId: new mongoose.Types.ObjectId(dealId),
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $addFields: {
                    // Calculate quantity from sizeCommitments or use regular quantity
                    calculatedQuantity: {
                        $cond: {
                            if: { $isArray: "$sizeCommitments" },
                            then: {
                                $reduce: {
                                    input: "$sizeCommitments",
                                    initialValue: 0,
                                    in: { $add: ["$$value", "$$this.quantity"] }
                                }
                            },
                            else: { $ifNull: ["$quantity", 0] }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalOrders: { $sum: 1 },
                    totalQuantity: { $sum: "$calculatedQuantity" },
                    totalRevenue: { $sum: "$totalPrice" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    maxOrderValue: { $max: "$totalPrice" },
                    minOrderValue: { $min: "$totalPrice" },
                    uniqueMembers: { $addToSet: "$userId" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Member analysis with size data
        const memberAnalysis = await Commitment.aggregate([
            { $match: { dealId: new mongoose.Types.ObjectId(dealId) } },
            {
                $addFields: {
                    // Calculate quantity from sizeCommitments or use regular quantity
                    calculatedQuantity: {
                        $cond: {
                            if: { $isArray: "$sizeCommitments" },
                            then: {
                                $reduce: {
                                    input: "$sizeCommitments",
                                    initialValue: 0,
                                    in: { $add: ["$$value", "$$this.quantity"] }
                                }
                            },
                            else: { $ifNull: ["$quantity", 0] }
                        }
                    },
                    // Extract size breakdown for analytics
                    sizeBreakdownObj: {
                        $cond: {
                            if: { $isArray: "$sizeCommitments" },
                            then: {
                                $arrayToObject: {
                                    $map: {
                                        input: "$sizeCommitments",
                                        as: "size",
                                        in: { k: "$$size.size", v: "$$size.quantity" }
                                    }
                                }
                            },
                            else: {}
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    totalCommitments: { $sum: 1 },
                    totalQuantity: { $sum: "$calculatedQuantity" },
                    totalValue: { $sum: "$totalPrice" },
                    avgOrderValue: { $avg: "$totalPrice" },
                    avgQuantityPerOrder: { $avg: "$calculatedQuantity" },
                    maxQuantity: { $max: "$calculatedQuantity" },
                    minQuantity: { $min: "$calculatedQuantity" },
                    lastOrderDate: { $max: "$createdAt" },
                    firstOrderDate: { $min: "$createdAt" },
                    orderDates: { $push: "$createdAt" },
                    quantities: { $push: "$calculatedQuantity" },
                    values: { $push: "$totalPrice" },
                    // Merge size breakdowns from all orders
                    sizeBreakdowns: { $push: "$sizeBreakdownObj" }
                }
            },
            { $sort: { totalQuantity: -1 } }
        ]);

        const populatedMembers = await User.populate(memberAnalysis, {
            path: "_id",
            select: "businessName name"
        });

        // Process size breakdowns for each member
        populatedMembers.forEach(member => {
            // Combine size breakdowns from all orders
            member.sizeBreakdown = member.sizeBreakdowns.reduce((acc, orderSizes) => {
                Object.entries(orderSizes).forEach(([size, quantity]) => {
                    acc[size] = (acc[size] || 0) + quantity;
                });
                return acc;
            }, {});
            
            delete member.sizeBreakdowns; // Remove the intermediate data
        });

        // Quantity segments using calculatedQuantity
        const quantitySegments = await Commitment.aggregate([
            { $match: { dealId: new mongoose.Types.ObjectId(dealId) } },
            {
                $addFields: {
                    calculatedQuantity: {
                        $cond: {
                            if: { $isArray: "$sizeCommitments" },
                            then: {
                                $reduce: {
                                    input: "$sizeCommitments",
                                    initialValue: 0,
                                    in: { $add: ["$$value", "$$this.quantity"] }
                                }
                            },
                            else: { $ifNull: ["$quantity", 0] }
                        }
                    }
                }
            },
            {
                $bucket: {
                    groupBy: "$calculatedQuantity",
                    boundaries: [0, 50, 100, 500, 1000, Infinity],
                    default: "1000+",
                    output: {
                        count: { $sum: 1 },
                        totalValue: { $sum: "$totalPrice" },
                        avgValue: { $avg: "$totalPrice" },
                        members: { $addToSet: "$userId" },
                        totalQuantity: { $sum: "$calculatedQuantity" }
                    }
                }
            }
        ]);

        // Performance metrics
        const performanceMetrics = {
            peakHourOrders: Math.max(...hourlyData.map(h => h.count || 0), 0),
            peakDayOrders: Math.max(...dailyMetrics.map(d => d.totalOrders || 0), 0),
            averageDailyOrders: dailyMetrics.length ? dailyMetrics.reduce((sum, d) => sum + (d.totalOrders || 0), 0) / dailyMetrics.length : 0,
            totalUniqueMembers: new Set(commitments.map(c => c.userId.toString())).size,
            repeatOrderRate: commitments.length ? (commitments.length - new Set(commitments.map(c => c.userId.toString())).size) / commitments.length * 100 : 0,
            avgTimeToNextOrder: calculateAvgTimeBetweenOrders(commitments),
            orderCompletionRate: commitments.length ? (commitments.filter(c => c.status === 'approved').length / commitments.length) * 100 : 0
        };

        // Format response
        const analyticsData = {
            dealInfo: {
                name: deal.name,
                category: deal.category,
                distributor: deal.distributor.businessName || deal.distributor.name,
                originalCost: deal.originalCost,
                discountPrice: deal.discountPrice,
                sizes: deal.sizes || [],
                discountTiers: deal.discountTiers || [],
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
        res.status(500).json({ message: 'Error fetching analytics data', error: error.message });
    }
});

// Calculate average time between orders for repeat customers
function calculateAvgTimeBetweenOrders(commitments) {
    // Group commitments by user
    const userCommitments = commitments.reduce((acc, commitment) => {
        const userId = commitment.userId.toString();
        if (!acc[userId]) {
            acc[userId] = [];
        }
        acc[userId].push(new Date(commitment.createdAt));
        return acc;
    }, {});

    // Calculate time differences for users with multiple orders
    let totalDifference = 0;
    let count = 0;

    Object.values(userCommitments).forEach(dates => {
        if (dates.length > 1) {
            // Sort dates in ascending order
            dates.sort((a, b) => a - b);
            
            // Calculate time difference between orders
            for (let i = 1; i < dates.length; i++) {
                const difference = dates[i] - dates[i-1];
                totalDifference += difference;
                count++;
            }
        }
    });

    // Return average time difference in hours or 0 if no repeat orders
    return count > 0 ? totalDifference / count / (1000 * 60 * 60) : 0;
}

// Calculate deal progress (total sold / minimumQuantity)
function calculateDealProgress(deal) {
    const minQty = deal.minQtyForDiscount || 1;
    const totalSold = deal.totalSold || 0;
    return Math.min(100, (totalSold / minQty) * 100);
}

module.exports = router;

