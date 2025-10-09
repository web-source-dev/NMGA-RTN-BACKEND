const express = require('express');
const router = express.Router();
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get all approved commitments for a distributor
router.get('/distributor-orders/:userId', async (req, res) => {
    try {
        const distributorId = req.params.userId;
        const {
            startDate,
            endDate,
            minAmount,
            maxAmount,
            status,
            paymentStatus,
            deliveryStatus,
            sortBy,
            sortOrder,
            search,
            customerType,
            productId
        } = req.query;
        
        // Find all deals by this distributor
        const deals = await Deal.find({ distributor: distributorId });
        const dealIds = deals.map(deal => deal._id);

        // Build filter object
        const filter = { 
            dealId: { $in: dealIds }
        };

        // Add date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Add amount range filter
        if (minAmount || maxAmount) {
            filter.totalPrice = {};
            if (minAmount) filter.totalPrice.$gte = Number(minAmount);
            if (maxAmount) filter.totalPrice.$lte = Number(maxAmount);
        }

        // Add status filters
        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

        // Add product filter
        if (productId) {
            filter.dealId = productId;
        }

        // Build sort object
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = -1; // Default sort
        }

        // Get commitments with filters
        const commitments = await Commitment.find(filter)
        .populate('userId', 'name email phone businessName address')
        .populate('dealId', 'name description size discountPrice originalCost images')
        .sort(sortOptions);

        // Log the action
        await logCollaboratorAction(req, 'view_distributor_orders', 'orders', {
            totalOrders: commitments.length,
            startDate: startDate || 'all',
            endDate: endDate || 'all',
            status: status || 'all'
        });

        // Get unique products from deals
        const products = deals.map(deal => ({
            _id: deal._id,
            name: deal.name,
            price: deal.discountPrice,
            originalPrice: deal.originalCost,
            totalSold: deal.totalSold,
            revenue: deal.totalRevenue
        }));

        // Enhanced analytics processing
        const revenueByDate = {};
        const productDistribution = {};
        const hourlyDistribution = {};
        const customerSegments = {};
        const orderValueRanges = {
            '0-100': 0,
            '101-500': 0,
            '501-1000': 0,
            '1000+': 0
        };

        const paymentAnalytics = {
            byMethod: {},
            byStatus: {},
            averageProcessingTime: 0
        };

        const deliveryAnalytics = {
            byStatus: {},
            averageDeliveryTime: 0,
            byRegion: {},
            onTimeDeliveryRate: 0
        };

        const customerAnalytics = {
            averageRating: 0,
            ratingDistribution: {
                1: 0, 2: 0, 3: 0, 4: 0, 5: 0
            },
            feedbackSentiment: {
                positive: 0,
                neutral: 0,
                negative: 0
            }
        };

        let totalDeliveryTime = 0;
        let deliveredOrders = 0;
        let totalRating = 0;
        let ratedOrders = 0;

        commitments.forEach(commitment => {
            // Existing revenue data processing
            const date = new Date(commitment.createdAt).toLocaleDateString();
            if (!revenueByDate[date]) {
                revenueByDate[date] = { 
                    date, 
                    revenue: 0, 
                    orders: 0,
                    average: 0,
                    cumulativeRevenue: 0 
                };
            }
            revenueByDate[date].revenue += commitment.totalPrice;
            revenueByDate[date].orders += 1;
            
            // Hourly distribution
            const hour = new Date(commitment.createdAt).getHours();
            hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

            // Customer segmentation
            const customer = commitment.userId.businessName || commitment.userId.name;
            if (!customerSegments[customer]) {
                customerSegments[customer] = {
                    name: customer,
                    orders: 0,
                    totalSpent: 0,
                    averageOrderValue: 0
                };
            }
            customerSegments[customer].orders += 1;
            customerSegments[customer].totalSpent += commitment.totalPrice;

            // Order value ranges
            if (commitment.totalPrice <= 100) orderValueRanges['0-100']++;
            else if (commitment.totalPrice <= 500) orderValueRanges['101-500']++;
            else if (commitment.totalPrice <= 1000) orderValueRanges['501-1000']++;
            else orderValueRanges['1000+']++;

            // Product distribution (existing)
            const productName = commitment.dealId.name;
            if (!productDistribution[productName]) {
                productDistribution[productName] = { 
                    name: productName, 
                    value: 0,
                    revenue: 0,
                    orders: 0 
                };
            }
            productDistribution[productName].value += commitment.quantity;
            productDistribution[productName].revenue += commitment.totalPrice;
            productDistribution[productName].orders += 1;

            // Payment analytics
            paymentAnalytics.byMethod[commitment.paymentMethod] = 
                (paymentAnalytics.byMethod[commitment.paymentMethod] || 0) + 1;
            paymentAnalytics.byStatus[commitment.paymentStatus] = 
                (paymentAnalytics.byStatus[commitment.paymentStatus] || 0) + 1;

            // Delivery analytics
            deliveryAnalytics.byStatus[commitment.deliveryStatus] = 
                (deliveryAnalytics.byStatus[commitment.deliveryStatus] || 0) + 1;

            if (commitment.deliveryAddress?.state) {
                deliveryAnalytics.byRegion[commitment.deliveryAddress.state] = 
                    (deliveryAnalytics.byRegion[commitment.deliveryAddress.state] || 0) + 1;
            }

            if (commitment.actualDeliveryDate && commitment.estimatedDeliveryDate) {
                const deliveryTime = new Date(commitment.actualDeliveryDate) - new Date(commitment.estimatedDeliveryDate);
                totalDeliveryTime += deliveryTime;
                deliveredOrders++;
            }

            // Customer feedback analytics
            if (commitment.customerFeedback?.rating) {
                totalRating += commitment.customerFeedback.rating;
                ratedOrders++;
                customerAnalytics.ratingDistribution[commitment.customerFeedback.rating]++;
            }
        });

        // Calculate cumulative revenue and averages
        let cumulativeRevenue = 0;
        Object.values(revenueByDate).forEach(day => {
            cumulativeRevenue += day.revenue;
            day.cumulativeRevenue = cumulativeRevenue;
            day.average = day.orders > 0 ? day.revenue / day.orders : 0;
        });

        // Calculate customer segment averages
        Object.values(customerSegments).forEach(segment => {
            segment.averageOrderValue = segment.totalSpent / segment.orders;
        });

        // Enhanced funnel metrics
        const funnelMetrics = {
            impressions: deals.reduce((sum, deal) => sum + deal.impressions, 0),
            views: deals.reduce((sum, deal) => sum + deal.views, 0),
            interested: Math.round(deals.reduce((sum, deal) => sum + deal.views, 0) * 0.6), // Estimated interest
            commitments: commitments.length,
            conversion: {
                impressionToView: deals.reduce((sum, deal) => sum + deal.views, 0) / 
                                 deals.reduce((sum, deal) => sum + deal.impressions, 0) * 100,
                viewToInterest: 60, // Estimated percentage
                interestToCommitment: commitments.length / 
                                    (deals.reduce((sum, deal) => sum + deal.views, 0) * 0.6) * 100
            }
        };

        // Time-based engagement metrics
        const engagementTrends = deals.map(deal => ({
            date: deal.createdAt,
            impressions: deal.impressions,
            views: deal.views,
            conversionRate: (deal.views / (deal.impressions || 1)) * 100
        }));

        // Calculate averages and rates
        paymentAnalytics.averageProcessingTime = totalDeliveryTime / deliveredOrders;
        deliveryAnalytics.averageDeliveryTime = totalDeliveryTime / deliveredOrders;
        deliveryAnalytics.onTimeDeliveryRate = (deliveredOrders / commitments.length) * 100;
        customerAnalytics.averageRating = totalRating / ratedOrders;

        // Time-based comparison periods
        const now = new Date();
        const periods = {
            currentMonth: {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            },
            previousMonth: {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0)
            },
            lastYear: {
                start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
                end: new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)
            },
            yearToDate: {
                start: new Date(now.getFullYear(), 0, 1),
                end: now
            },
            lastYearToDate: {
                start: new Date(now.getFullYear() - 1, 0, 1),
                end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
            }
        };

        // Function to calculate metrics for a specific period
        const calculatePeriodMetrics = (startDate, endDate, orders) => {
            const periodOrders = orders.filter(order => 
                new Date(order.createdAt) >= startDate && 
                new Date(order.createdAt) <= endDate
            );

            const uniqueCustomers = new Set(periodOrders.map(order => order.userId._id.toString())).size;
            const totalRevenue = periodOrders.reduce((sum, order) => sum + order.totalPrice, 0);
            const totalQuantity = periodOrders.reduce((sum, order) => sum + order.quantity, 0);

            return {
                orderCount: periodOrders.length,
                revenue: totalRevenue,
                averageOrderValue: periodOrders.length > 0 ? totalRevenue / periodOrders.length : 0,
                uniqueCustomers,
                totalQuantity,
                customerRetentionRate: periodOrders.length > 0 ? (uniqueCustomers / periodOrders.length) * 100 : 0,
                dailyAverage: Math.round(periodOrders.length / ((endDate - startDate) / (1000 * 60 * 60 * 24)))
            };
        };

        // Calculate metrics for each period
        const periodMetrics = {};
        Object.entries(periods).forEach(([period, { start, end }]) => {
            periodMetrics[period] = calculatePeriodMetrics(start, end, commitments);
        });

        // Calculate growth rates and comparisons
        const comparisons = {
            monthOverMonth: {
                revenue: ((periodMetrics.currentMonth.revenue - periodMetrics.previousMonth.revenue) / periodMetrics.previousMonth.revenue) * 100,
                orders: ((periodMetrics.currentMonth.orderCount - periodMetrics.previousMonth.orderCount) / periodMetrics.previousMonth.orderCount) * 100,
                averageOrderValue: ((periodMetrics.currentMonth.averageOrderValue - periodMetrics.previousMonth.averageOrderValue) / periodMetrics.previousMonth.averageOrderValue) * 100
            },
            yearOverYear: {
                revenue: ((periodMetrics.currentMonth.revenue - periodMetrics.lastYear.revenue) / periodMetrics.lastYear.revenue) * 100,
                orders: ((periodMetrics.currentMonth.orderCount - periodMetrics.lastYear.orderCount) / periodMetrics.lastYear.orderCount) * 100,
                averageOrderValue: ((periodMetrics.currentMonth.averageOrderValue - periodMetrics.lastYear.averageOrderValue) / periodMetrics.lastYear.averageOrderValue) * 100
            },
            ytdGrowth: {
                revenue: ((periodMetrics.yearToDate.revenue - periodMetrics.lastYearToDate.revenue) / periodMetrics.lastYearToDate.revenue) * 100,
                orders: ((periodMetrics.yearToDate.orderCount - periodMetrics.lastYearToDate.orderCount) / periodMetrics.lastYearToDate.orderCount) * 100,
                averageOrderValue: ((periodMetrics.yearToDate.averageOrderValue - periodMetrics.lastYearToDate.averageOrderValue) / periodMetrics.lastYearToDate.averageOrderValue) * 100
            }
        };

        // Calculate seasonal trends
        const seasonalAnalysis = {};
        const seasons = {
            spring: [2, 3, 4],
            summer: [5, 6, 7],
            fall: [8, 9, 10],
            winter: [11, 0, 1]
        };

        Object.entries(seasons).forEach(([season, months]) => {
            const seasonalOrders = commitments.filter(order => 
                months.includes(new Date(order.createdAt).getMonth())
            );
            
            seasonalAnalysis[season] = {
                orderCount: seasonalOrders.length,
                revenue: seasonalOrders.reduce((sum, order) => sum + order.totalPrice, 0),
                averageOrderValue: seasonalOrders.length > 0 ? 
                    seasonalOrders.reduce((sum, order) => sum + order.totalPrice, 0) / seasonalOrders.length : 0
            };
        });

        // Calculate day-of-week trends
        const dowTrends = Array(7).fill(0).map(() => ({ orders: 0, revenue: 0 }));
        commitments.forEach(order => {
            const dow = new Date(order.createdAt).getDay();
            dowTrends[dow].orders++;
            dowTrends[dow].revenue += order.totalPrice;
        });

        // Calculate hour-of-day trends
        const hourlyTrends = Array(24).fill(0).map(() => ({ orders: 0, revenue: 0 }));
        commitments.forEach(order => {
            const hour = new Date(order.createdAt).getHours();
            hourlyTrends[hour].orders++;
            hourlyTrends[hour].revenue += order.totalPrice;
        });

        // Enhanced analytics object with all new metrics
        const enhancedAnalytics = {
            // Existing metrics
            totalOrders: commitments.length,
            totalRevenue: commitments.reduce((sum, comm) => sum + comm.totalPrice, 0),
            totalQuantitySold: commitments.reduce((sum, comm) => sum + comm.quantity, 0),
            averageOrderValue: commitments.length > 0 
                ? commitments.reduce((sum, comm) => sum + comm.totalPrice, 0) / commitments.length 
                : 0,
            dailyOrders: Object.values(revenueByDate).slice(-1)[0]?.orders || 0,
            weeklyOrders: Object.values(revenueByDate).slice(-7).reduce((sum, day) => sum + day.orders, 0),
            monthlyOrders: Object.values(revenueByDate).slice(-30).reduce((sum, day) => sum + day.orders, 0),

            // Enhanced metrics
            revenueData: Object.values(revenueByDate),
            productDistribution: Object.values(productDistribution),
            hourlyDistribution: Object.entries(hourlyDistribution).map(([hour, count]) => ({
                hour: parseInt(hour),
                count
            })),
            customerSegments: Object.values(customerSegments),
            orderValueRanges: Object.entries(orderValueRanges).map(([range, count]) => ({
                range,
                count
            })),
            performanceMetrics: {
                conversionRate: (commitments.length / (deals.reduce((sum, deal) => sum + deal.views, 0) || 1) * 100).toFixed(2),
                averageOrderCompletion: 15, // minutes (mock data)
                customerRetentionRate: 85, // percentage (mock data)
            },
            funnelMetrics: funnelMetrics,
            engagementTrends: engagementTrends,
            periodMetrics,
            comparisons,
            seasonalAnalysis,
            dowTrends,
            hourlyTrends,
            trends: {
                daily: Object.entries(revenueByDate).map(([date, data]) => ({
                    date,
                    ...data
                })),
                weekly: calculateWeeklyTrends(commitments),
                monthly: calculateMonthlyTrends(commitments)
            }
        };

        // Add to existing analytics object
        const analytics = {
            ...enhancedAnalytics,
            paymentAnalytics,
            deliveryAnalytics,
            customerAnalytics,
            orderLifecycle: {
                newOrders: commitments.filter(c => c.status === "pending").length,
                inProgress: commitments.filter(c => c.status === "approved" && c.deliveryStatus !== "delivered").length,
                completed: commitments.filter(c => c.deliveryStatus === "delivered").length,
                cancelled: commitments.filter(c => c.status === "cancelled").length
            }
        };

        res.status(200).json({ 
            commitments, 
            analytics: analytics,
            products
        });
    } catch (error) {
        await logError(req, 'view_distributor_orders', 'orders', error, {
            userId: req.params.userId
        });
        res.status(500).json({ message: "Error fetching orders", error: error.message });
    }
});

// Helper function to calculate weekly trends
function calculateWeeklyTrends(commitments) {
    const weeklyData = {};
    commitments.forEach(order => {
        const date = new Date(order.createdAt);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
                orders: 0,
                revenue: 0,
                quantity: 0
            };
        }
        
        weeklyData[weekKey].orders++;
        weeklyData[weekKey].revenue += order.totalPrice;
        weeklyData[weekKey].quantity += order.quantity;
    });
    
    return Object.entries(weeklyData).map(([week, data]) => ({
        week,
        ...data,
        averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
    }));
}

// Helper function to calculate monthly trends
function calculateMonthlyTrends(commitments) {
    const monthlyData = {};
    commitments.forEach(order => {
        const date = new Date(order.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                orders: 0,
                revenue: 0,
                quantity: 0
            };
        }
        
        monthlyData[monthKey].orders++;
        monthlyData[monthKey].revenue += order.totalPrice;
        monthlyData[monthKey].quantity += order.quantity;
    });
    
    return Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
        averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0
    }));
}

// Add new endpoint for detailed order information
router.get('/order-details/:orderId', async (req, res) => {
    try {
        const order = await Commitment.findById(req.params.orderId)
            .populate('userId', 'name email phone businessName address')
            .populate('dealId', 'name description size discountPrice originalCost images');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        await logCollaboratorAction(req, 'view_order_details', 'order', {
            orderId: req.params.orderId,
            resourceId: order._id
        });

        res.status(200).json({ order });
    } catch (error) {
        await logError(req, 'view_order_details', 'order', error, {
            orderId: req.params.orderId
        });
        res.status(500).json({ message: "Error fetching order details", error: error.message });
    }
});

// Add endpoint for updating delivery status
router.patch('/update-delivery/:orderId', async (req, res) => {
    try {
        const { deliveryStatus, trackingNumber, estimatedDeliveryDate } = req.body;
        
        const order = await Commitment.findByIdAndUpdate(
            req.params.orderId,
            {
                deliveryStatus,
                trackingNumber,
                estimatedDeliveryDate,
                ...(deliveryStatus === 'delivered' && { actualDeliveryDate: new Date() })
            },
            { new: true }
        );

        await logCollaboratorAction(req, 'update_delivery_status', 'order', {
            orderId: req.params.orderId,
            deliveryStatus: deliveryStatus,
            resourceId: order._id
        });

        res.status(200).json({ order });
    } catch (error) {
        await logError(req, 'update_delivery_status', 'order', error, {
            orderId: req.params.orderId
        });
        res.status(500).json({ message: "Error updating delivery status", error: error.message });
    }
});

// Update order status
router.patch('/update-status/:orderId', async (req, res) => {
    try {
        const { status, notes } = req.body;
        const order = await Commitment.findByIdAndUpdate(
            req.params.orderId,
            {
                status,
                statusNotes: notes,
                updatedAt: new Date()
            },
            { new: true }
        ).populate('userId dealId');
        
        await logCollaboratorAction(req, 'update_order_status', 'order', {
            orderId: req.params.orderId,
            status: status,
            resourceId: order._id
        });

        res.status(200).json({ order });
    } catch (error) {
        await logError(req, 'update_order_status', 'order', error, {
            orderId: req.params.orderId,
            status: req.body.status
        });
        res.status(500).json({ message: "Error updating order status", error: error.message });
    }
});

// Update payment status
router.patch('/update-payment/:orderId', async (req, res) => {
    try {
        const { paymentStatus, paymentNotes } = req.body;
        const order = await Commitment.findByIdAndUpdate(
            req.params.orderId,
            {
                paymentStatus,
                paymentNotes,
                updatedAt: new Date()
            },
            { new: true }
        ).populate('userId dealId');
        
        await logCollaboratorAction(req, 'update_payment_status', 'order', {
            orderId: req.params.orderId,
            paymentStatus: paymentStatus,
            resourceId: order._id
        });

        res.status(200).json({ order });
    } catch (error) {
        await logError(req, 'update_payment_status', 'order', error, {
            orderId: req.params.orderId,
            paymentStatus: req.body.paymentStatus
        });
        res.status(500).json({ message: "Error updating payment status", error: error.message });
    }
});

// Generate invoice
router.get('/generate-invoice/:orderId', async (req, res) => {
    try {
        const order = await Commitment.findById(req.params.orderId)
            .populate('userId', 'name email phone businessName address')
            .populate('dealId', 'name description size discountPrice originalCost');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order._id}.pdf`);

        doc.pipe(res);

        // Add invoice styling and content
        doc.fontSize(20).text('INVOICE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Invoice Date: ${new Date().toLocaleDateString()}`);
        doc.text(`Order ID: ${order._id}`);
        doc.moveDown();
        
        // Customer details
        doc.fontSize(14).text('Customer Details');
        doc.fontSize(10).text(`Name: ${order.userId.businessName || order.userId.name}`);
        doc.text(`Email: ${order.userId.email}`);
        doc.text(`Phone: ${order.userId.phone}`);
        doc.moveDown();

        // Order details
        doc.fontSize(14).text('Order Details');
        doc.fontSize(10).text(`Product: ${order.dealId.name}`);
        doc.text(`Quantity: ${order.quantity}`);
        doc.text(`Price per unit: $${order.dealId.discountPrice}`);
        doc.text(`Total Amount: $${order.totalPrice}`);
        doc.moveDown();

        // Payment details
        doc.fontSize(14).text('Payment Details');
        doc.fontSize(10).text(`Status: ${order.paymentStatus}`);
        doc.text(`Payment Method: ${order.paymentMethod || 'Not specified'}`);

        await logCollaboratorAction(req, 'generate_invoice', 'invoice', {
            orderId: req.params.orderId,
            resourceId: order._id
        });

        doc.end();
    } catch (error) {
        await logError(req, 'generate_invoice', 'invoice', error, {
            orderId: req.params.orderId
        });
        res.status(500).json({ message: "Error generating invoice", error: error.message });
    }
});

// Enhance the existing filtered endpoint with more options
router.get('/distributor-orders/:userId/filtered', async (req, res) => {
    try {
        const distributorId = req.params.userId;
        const {
            startDate,
            endDate,
            minAmount,
            maxAmount,
            status,
            paymentStatus,
            deliveryStatus,
            sortBy,
            sortOrder,
            search,
            customerType,
            productId
        } = req.query;

        // Build filter object
        const filter = { 
            dealId: { $in: (await Deal.find({ distributor: distributorId })).map(deal => deal._id) }
        };

        // Add date range filter
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Add amount range filter
        if (minAmount || maxAmount) {
            filter.totalPrice = {};
            if (minAmount) filter.totalPrice.$gte = Number(minAmount);
            if (maxAmount) filter.totalPrice.$lte = Number(maxAmount);
        }

        // Add status filters
        if (status) filter.status = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

        // Add product filter
        if (productId) {
            filter.dealId = productId;
        }

        // Add search functionality
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filter.$or = [
                { 'userId.name': searchRegex },
                { 'userId.businessName': searchRegex },
                { 'userId.email': searchRegex },
                { 'dealId.name': searchRegex }
            ];
        }

        // Build sort object
        const sortOptions = {};
        if (sortBy) {
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sortOptions.createdAt = -1; // Default sort
        }

        const commitments = await Commitment.find(filter)
            .populate('userId', 'name email phone businessName address')
            .populate('dealId', 'name description size discountPrice originalCost')
            .sort(sortOptions);

        // Calculate analytics for filtered data
        const filteredAnalytics = {
            totalOrders: commitments.length,
            totalRevenue: commitments.reduce((sum, order) => sum + order.totalPrice, 0),
            averageOrderValue: commitments.length > 0 
                ? commitments.reduce((sum, order) => sum + order.totalPrice, 0) / commitments.length 
                : 0,
            statusBreakdown: commitments.reduce((acc, order) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            }, {})
        };

        await logCollaboratorAction(req, 'view_filtered_orders', 'orders', {
            userId: req.params.userId,
            totalOrders: commitments.length,
            filters: Object.keys(req.query).length
        });

        res.status(200).json({ 
            commitments,
            analytics: filteredAnalytics
        });
    } catch (error) {
        await logError(req, 'view_filtered_orders', 'orders', error, {
            userId: req.params.userId
        });
        res.status(500).json({ message: "Error filtering orders", error: error.message });
    }
});

// Helper function to create CSV content
const createCSVContent = (headers, rows) => {
    // Add BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';
    
    // Escape and format CSV values properly
    const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '""';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const csvContent = [
        headers.map(escapeCsvValue).join(','),
        ...rows.map(row => row.map(escapeCsvValue).join(','))
    ].join('\r\n'); // Use Windows-style line endings for better Excel compatibility

    return BOM + csvContent;
};

// Download orders endpoint
router.get('/distributor-orders/:userId/download', async (req, res) => {
    try {
        const distributorId = req.params.userId;
        const { 
            format, 
            includeAnalytics,
            timeZone,
            reportType,
            page,
            pageSize,
            ...filterParams 
        } = req.query;

        // Build filter object
        const filter = { 
            dealId: { $in: (await Deal.find({ distributor: distributorId })).map(deal => deal._id) }
        };

        // Apply all filters
        if (filterParams.startDate || filterParams.endDate) {
            filter.createdAt = {};
            if (filterParams.startDate) filter.createdAt.$gte = new Date(filterParams.startDate);
            if (filterParams.endDate) filter.createdAt.$lte = new Date(filterParams.endDate);
        }

        if (filterParams.minAmount || filterParams.maxAmount) {
            filter.totalPrice = {};
            if (filterParams.minAmount) filter.totalPrice.$gte = Number(filterParams.minAmount);
            if (filterParams.maxAmount) filter.totalPrice.$lte = Number(filterParams.maxAmount);
        }

        if (filterParams.status) filter.status = filterParams.status;
        if (filterParams.paymentStatus) filter.paymentStatus = filterParams.paymentStatus;
        if (filterParams.deliveryStatus) filter.deliveryStatus = filterParams.deliveryStatus;
        if (filterParams.productId) filter.dealId = filterParams.productId;

        // Get filtered orders with full population
        const orders = await Commitment.find(filter)
            .populate('userId', 'name email phone businessName address')
            .populate('dealId', 'name description size discountPrice originalCost images')
            .sort({ [filterParams.sortBy || 'createdAt']: filterParams.sortOrder === 'desc' ? -1 : 1 });

        // Log the download action
        await logCollaboratorAction(req, 'download_orders', 'orders', {
            userId: req.params.userId,
            format: format,
            totalOrders: orders.length,
            includeAnalytics: includeAnalytics === 'true'
        });

        // Calculate analytics if requested
        let analytics = null;
        if (includeAnalytics === 'true') {
            analytics = {
                totalOrders: orders.length,
                totalRevenue: orders.reduce((sum, order) => sum + order.totalPrice, 0),
                averageOrderValue: orders.length > 0 
                    ? orders.reduce((sum, order) => sum + order.totalPrice, 0) / orders.length 
                    : 0,
                statusBreakdown: orders.reduce((acc, order) => {
                    acc[order.status] = (acc[order.status] || 0) + 1;
                    return acc;
                }, {}),
                paymentMethodBreakdown: orders.reduce((acc, order) => {
                    acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
                    return acc;
                }, {}),
                timeDistribution: orders.reduce((acc, order) => {
                    const hour = new Date(order.createdAt).getHours();
                    acc[hour] = (acc[hour] || 0) + 1;
                    return acc;
                }, {}),
                customerStats: {
                    totalCustomers: new Set(orders.map(o => o.userId._id.toString())).size,
                    topCustomers: Object.entries(orders.reduce((acc, order) => {
                        const customerId = order.userId._id.toString();
                        if (!acc[customerId]) {
                            acc[customerId] = {
                                name: order.userId.businessName || order.userId.name,
                                orders: 0,
                                totalSpent: 0
                            };
                        }
                        acc[customerId].orders++;
                        acc[customerId].totalSpent += order.totalPrice;
                        return acc;
                    }, {}))
                    .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
                    .slice(0, 5)
                    .map(([_, data]) => data)
                }
            };
        }

        if (format === 'csv') {
            // Create a ZIP archive with specific options
            const archive = archiver('zip', {
                zlib: { level: 9 },
                forceZip64: false // Ensure compatibility
            });

            // Set proper headers for ZIP file
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=orders-report-${new Date().toISOString().split('T')[0]}.zip`);
            res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

            // Handle archive errors
            archive.on('error', (err) => {
                throw err;
            });

            // Pipe archive data to response
            archive.pipe(res);

            // 1. Main Orders Sheet - with proper date formatting
            const ordersHeaders = [
                'Order ID',
                'Date',
                'Time',
                'Customer Name',
                'Customer Email',
                'Customer Phone',
                'Business Name',
                'Product Name',
                'Product Description',
                'Quantity',
                'Unit Price (USD)',
                'Total Price (USD)',
                'Status',
                'Payment Status',
                'Payment Method',
                'Delivery Status',
                'Tracking Number',
                'Estimated Delivery',
                'Actual Delivery',
                'Notes'
            ];

            const ordersRows = orders.map(order => {
                const date = new Date(order.createdAt);
                const localDate = new Date(date.toLocaleString('en-US', { timeZone }));
                
                return [
                    order._id,
                    localDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
                    localDate.toLocaleTimeString('en-US', { hour12: false }),
                    order.userId.businessName || order.userId.name || 'N/A',
                    order.userId.email || 'N/A',
                    order.userId.phone || 'N/A',
                    order.userId.businessName || 'N/A',
                    order.dealId.name || 'N/A',
                    (order.dealId.description || 'N/A').replace(/[\n\r]+/g, ' '), // Remove line breaks
                    order.quantity || 0,
                    Number(order.dealId.discountPrice || 0).toFixed(2),
                    Number(order.totalPrice || 0).toFixed(2),
                    order.status || 'N/A',
                    order.paymentStatus || 'N/A',
                    order.paymentMethod || 'N/A',
                    order.deliveryStatus || 'N/A',
                    order.trackingNumber || 'N/A',
                    order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US') : 'N/A',
                    order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toLocaleDateString('en-US') : 'N/A',
                    (order.notes || 'N/A').replace(/[\n\r]+/g, ' ') // Remove line breaks
                ];
            });

            // Add orders sheet to ZIP with proper encoding
            archive.append(createCSVContent(ordersHeaders, ordersRows), { 
                name: '1_orders.csv',
                store: true // Don't re-compress already compressed data
            });

            // 2. Financial Summary Sheet
            const financialHeaders = [
                'Metric',
                'Value',
                'Additional Info'
            ];

            const financialRows = [
                ['Total Revenue', analytics.totalRevenue.toFixed(2), 'USD'],
                ['Average Order Value', analytics.averageOrderValue.toFixed(2), 'USD'],
                ['Total Orders', analytics.totalOrders, ''],
                ['Revenue per Customer', (analytics.totalRevenue / analytics.customerStats.totalCustomers).toFixed(2), 'USD'],
                ['Highest Order Value', Math.max(...orders.map(o => o.totalPrice)).toFixed(2), 'USD'],
                ['Lowest Order Value', Math.min(...orders.map(o => o.totalPrice)).toFixed(2), 'USD']
            ];

            archive.append(
                createCSVContent(financialHeaders, financialRows),
                { name: '2_financial_summary.csv' }
            );

            // 3. Customer Analysis Sheet
            const customerHeaders = [
                'Customer Name',
                'Total Orders',
                'Total Spent',
                'Average Order Value',
                'First Order Date',
                'Latest Order Date',
                'Preferred Payment Method'
            ];

            const customerAnalysis = Object.values(orders.reduce((acc, order) => {
                const customerId = order.userId._id.toString();
                if (!acc[customerId]) {
                    acc[customerId] = {
                        name: order.userId.businessName || order.userId.name,
                        orders: 0,
                        totalSpent: 0,
                        firstOrder: order.createdAt,
                        latestOrder: order.createdAt,
                        paymentMethods: {}
                    };
                }
                acc[customerId].orders++;
                acc[customerId].totalSpent += order.totalPrice;
                acc[customerId].firstOrder = new Date(Math.min(new Date(acc[customerId].firstOrder), new Date(order.createdAt)));
                acc[customerId].latestOrder = new Date(Math.max(new Date(acc[customerId].latestOrder), new Date(order.createdAt)));
                acc[customerId].paymentMethods[order.paymentMethod] = (acc[customerId].paymentMethods[order.paymentMethod] || 0) + 1;
                return acc;
            }, {}));

            const customerRows = customerAnalysis.map(customer => [
                customer.name,
                customer.orders,
                customer.totalSpent.toFixed(2),
                (customer.totalSpent / customer.orders).toFixed(2),
                new Date(customer.firstOrder).toLocaleDateString(),
                new Date(customer.latestOrder).toLocaleDateString(),
                Object.entries(customer.paymentMethods)
                    .sort((a, b) => b[1] - a[1])[0][0]
            ]);

            archive.append(
                createCSVContent(customerHeaders, customerRows),
                { name: '3_customer_analysis.csv' }
            );

            // 4. Product Performance Sheet
            const productHeaders = [
                'Product Name',
                'Total Orders',
                'Total Units Sold',
                'Total Revenue',
                'Average Units per Order',
                'Average Revenue per Order'
            ];

            const productAnalysis = Object.values(orders.reduce((acc, order) => {
                const productId = order.dealId._id.toString();
                if (!acc[productId]) {
                    acc[productId] = {
                        name: order.dealId.name,
                        orders: 0,
                        unitsSold: 0,
                        revenue: 0
                    };
                }
                acc[productId].orders++;
                acc[productId].unitsSold += order.quantity;
                acc[productId].revenue += order.totalPrice;
                return acc;
            }, {}));

            const productRows = productAnalysis.map(product => [
                product.name,
                product.orders,
                product.unitsSold,
                product.revenue.toFixed(2),
                (product.unitsSold / product.orders).toFixed(2),
                (product.revenue / product.orders).toFixed(2)
            ]);

            archive.append(
                createCSVContent(productHeaders, productRows),
                { name: '4_product_performance.csv' }
            );

            // 5. Time Analysis Sheet
            const timeHeaders = [
                'Time Period',
                'Orders Count',
                'Total Revenue',
                'Average Order Value'
            ];

            // Daily breakdown
            const dailyAnalysis = orders.reduce((acc, order) => {
                const date = new Date(order.createdAt).toLocaleDateString();
                if (!acc[date]) {
                    acc[date] = { orders: 0, revenue: 0 };
                }
                acc[date].orders++;
                acc[date].revenue += order.totalPrice;
                return acc;
            }, {});

            const timeRows = [
                ['Daily Breakdown', '', ''],
                ...Object.entries(dailyAnalysis).map(([date, data]) => [
                    date,
                    data.orders,
                    data.revenue.toFixed(2),
                    (data.revenue / data.orders).toFixed(2)
                ]),
                ['', '', ''],
                ['Hourly Breakdown', '', ''],
                ...Object.entries(analytics.timeDistribution).map(([hour, count]) => [
                    `${hour}:00 - ${hour}:59`,
                    count,
                    orders.filter(o => new Date(o.createdAt).getHours() === parseInt(hour))
                        .reduce((sum, o) => sum + o.totalPrice, 0).toFixed(2),
                    (orders.filter(o => new Date(o.createdAt).getHours() === parseInt(hour))
                        .reduce((sum, o) => sum + o.totalPrice, 0) / count).toFixed(2)
                ])
            ];

            archive.append(
                createCSVContent(timeHeaders, timeRows),
                { name: '5_time_analysis.csv' }
            );

            // 6. Status and Payment Analysis Sheet
            const statusHeaders = [
                'Category',
                'Type',
                'Count',
                'Percentage',
                'Total Value'
            ];

            const statusRows = [
                ['Order Status', '', '', ''],
                ...Object.entries(analytics.statusBreakdown).map(([status, count]) => [
                    'Order Status',
                    status,
                    count,
                    ((count / orders.length) * 100).toFixed(2) + '%',
                    orders.filter(o => o.status === status)
                        .reduce((sum, o) => sum + o.totalPrice, 0).toFixed(2)
                ]),
                ['', '', '', ''],
                ['Payment Method', '', '', ''],
                ...Object.entries(analytics.paymentMethodBreakdown).map(([method, count]) => [
                    'Payment Method',
                    method,
                    count,
                    ((count / orders.length) * 100).toFixed(2) + '%',
                    orders.filter(o => o.paymentMethod === method)
                        .reduce((sum, o) => sum + o.totalPrice, 0).toFixed(2)
                ])
            ];

            archive.append(
                createCSVContent(statusHeaders, statusRows),
                { name: '6_status_analysis.csv' }
            );

            // Ensure proper finalization
            try {
                await new Promise((resolve, reject) => {
                    archive.finalize();
                    archive.on('end', resolve);
                    archive.on('error', reject);
                });
            } catch (error) {
                console.error('Error finalizing archive:', error);
                throw error;
            }

        } else if (format === 'pdf') {
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ 
                margin: 30, 
                size: 'A4',
                bufferPages: true
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=orders-${new Date().toISOString().split('T')[0]}.pdf`);

            // Pipe the PDF document to the response
            doc.pipe(res);

            // Add header with logo and title
            doc.fontSize(20).text('Orders Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Generated on: ${new Date().toLocaleString()}`);
            doc.moveDown();

            // Add filter summary if filters are applied
            if (Object.values(filterParams).some(v => v)) {
                doc.fontSize(14).text('Applied Filters', { underline: true });
                Object.entries(filterParams).forEach(([key, value]) => {
                    if (value) {
                        doc.fontSize(10).text(`${key}: ${value}`);
                    }
                });
                doc.moveDown();
            }

            // Add analytics summary if requested
            if (analytics) {
                doc.fontSize(14).text('Analytics Summary', { underline: true });
                doc.fontSize(10)
                   .text(`Total Orders: ${analytics.totalOrders}`)
                   .text(`Total Revenue: $${analytics.totalRevenue.toFixed(2)}`)
                   .text(`Average Order Value: $${analytics.averageOrderValue.toFixed(2)}`);
                doc.moveDown();

                // Add status breakdown
                doc.fontSize(12).text('Status Breakdown', { underline: true });
                Object.entries(analytics.statusBreakdown).forEach(([status, count]) => {
                    doc.fontSize(10).text(`${status}: ${count} orders`);
                });
                doc.moveDown();

                // Add top customers section
                doc.fontSize(12).text('Top Customers', { underline: true });
                analytics.customerStats.topCustomers.forEach(customer => {
                    doc.fontSize(10).text(
                        `${customer.name}: ${customer.orders} orders, $${customer.totalSpent.toFixed(2)} total spent`
                    );
                });
                doc.moveDown();
            }

            // Add orders table
            const tableTop = doc.y + 20;
            const itemsPerPage = 15;
            let currentPage = 1;

            // Table headers
            const drawTableHeaders = (y) => {
                doc.fontSize(10)
                   .text('Order ID', 50, y)
                   .text('Date', 150, y)
                   .text('Customer', 250, y)
                   .text('Product', 350, y)
                   .text('Total', 450, y);
                return y + 20;
            };

            let y = drawTableHeaders(tableTop);

            orders.forEach((order, index) => {
                if (y > 700) {
                    doc.addPage();
                    y = drawTableHeaders(50);
                }

                doc.fontSize(8)
                   .text(order._id.toString().substring(0, 10), 50, y)
                   .text(new Date(order.createdAt).toLocaleDateString(), 150, y)
                   .text(order.userId.businessName || order.userId.name, 250, y)
                   .text(order.dealId.name, 350, y)
                   .text(`$${order.totalPrice.toFixed(2)}`, 450, y);

                y += 20;
            });

            // Add page numbers
            let pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8)
                   .text(
                        `Page ${i + 1} of ${pages.count}`,
                        30,
                        doc.page.height - 30,
                        { align: 'center' }
                    );
            }

            // Finalize PDF
            doc.end();
        } else {
            res.status(400).json({ message: "Invalid format specified" });
        }
    } catch (error) {
        console.error('Error generating download:', error);
        await logError(req, 'download_orders', 'orders', error, {
            userId: req.params.userId,
            format: req.query.format
        });
        res.status(500).json({ message: "Error generating download", error: error.message });
    }
});

module.exports = router;
