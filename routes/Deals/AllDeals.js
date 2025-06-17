const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
// Send email notifications to all users
const sendEmail = require('../../utils/email');
const CommitmentNotificationTemplate = require('../../utils/EmailTemplates/CommitmentNotificationTemplate');
const { broadcastDealUpdate, broadcastSingleDealUpdate } = require('../../utils/dealUpdates');

// Get all deals with commitments for a distributor
router.get('/distributor-deals', async (req, res) => {
    try {
        const {
            distributorId,
            page = 1,
            limit = 10,
            search = '',
            month,
            status,
            startDate,
            endDate,
            commitmentStatus
        } = req.query;

        // Base query
        let query = { distributor: distributorId };

        // Add condition to only get deals with commitments
        query = {
            ...query,
            commitments: { $exists: true, $ne: [] }
        };

        // Search filter
        if (search) {
            query = {
                ...query,
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Date filters
        let dateQuery = {};

        if (month) {
            const currentYear = new Date().getFullYear();
            const monthIndex = parseInt(month) - 1; // Convert to 0-based index
            const startOfMonth = new Date(currentYear, monthIndex, 1);
            const endOfMonth = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
            dateQuery = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };
        } else if (startDate && endDate) {
            dateQuery = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else {
            // Default to current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            dateQuery = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };
        }

        query = { ...query, ...dateQuery };

        // Status filter
        if (status) {
            query.status = status;
        }

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total count for pagination (this will now only count deals with commitments)
        const totalDeals = await Deal.countDocuments(query);

        // Fetch deals with pagination
        const deals = await Deal.find(query)
            .populate({
                path: 'commitments',
                populate: {
                    path: 'userId',
                    select: 'name email businessName'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Transform the data (no need to filter null values anymore)
        const dealsWithStats = deals.map(deal => {
            const commitments = deal.commitments || [];
            let filteredCommitments = commitments;

            // Filter commitments by status if specified
            if (commitmentStatus) {
                filteredCommitments = commitments.filter(c => c.status === commitmentStatus);
            }

            const approvedCommitments = commitments.filter(c => c.status === 'approved');
            const pendingCommitments = commitments.filter(c => c.status === 'pending');

            // Calculate total quantity for each status
            const calcTotalQuantity = (commitArray) => {
                return commitArray.reduce((sum, c) => {
                    // If sizeCommitments exists, sum all sizes
                    if (c.sizeCommitments && c.sizeCommitments.length > 0) {
                        return sum + c.sizeCommitments.reduce((sizeSum, sizeItem) => 
                            sizeSum + sizeItem.quantity, 0);
                    }
                    // Fall back to regular quantity
                    return sum + (c.quantity || 0);
                }, 0);
            };

            const pendingTotalQuantity = calcTotalQuantity(pendingCommitments);
            const approvedTotalQuantity = calcTotalQuantity(approvedCommitments);

            return {
                _id: deal._id,
                name: deal.name,
                description: deal.description,
                size: deal.size,
                sizes: deal.sizes || [],
                originalCost: deal.originalCost,
                discountPrice: deal.discountPrice,
                minimumQuantity: deal.minQtyForDiscount,
                discountTiers: deal.discountTiers || [],
                category: deal.category,
                status: deal.status,
                dealEndsAt: deal.dealEndsAt,
                bulkAction: deal.bulkAction,
                bulkStatus: deal.bulkStatus,
                createdAt: deal.createdAt,
                totalCommitments: commitments.length,
                pendingCommitments: commitments.filter(c => c.status === 'pending').length,
                approvedCommitments: commitments.filter(c => c.status === 'approved').length,
                declinedCommitments: commitments.filter(c => c.status === 'declined').length,

                totalPQuantity: pendingTotalQuantity,
                totalPAmount: pendingCommitments.reduce((sum, c) => sum + c.totalPrice, 0),
                totalQuantity: approvedTotalQuantity,
                totalAmount: approvedCommitments.reduce((sum, c) => sum + c.totalPrice, 0)
            };
        }).filter(deal => deal !== null); // Remove null values

        res.json({
            success: true,
            deals: dealsWithStats,
            pagination: {
                total: totalDeals,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalDeals / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching distributor deals:', error);
        res.status(500).json({ success: false, message: 'Error fetching deals' });
    }
});

// Get all deals with commitments for admin
router.get('/admin-all-deals', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            month,
            status,
            startDate,
            endDate,
            commitmentStatus,
            distributorId
        } = req.query;

        // Base query
        let query = {};
        query = {
            ...query,
            commitments: { $exists: true, $ne: [] }
        };
        // If distributorId is provided, filter by that distributor
        if (distributorId) {
            query.distributor = distributorId;
        }

        // Search filter
        if (search) {
            query = {
                ...query,
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Date filters
        let dateQuery = {};

        if (month) {
            const currentYear = new Date().getFullYear();
            const monthIndex = parseInt(month) - 1; // Convert to 0-based index
            const startOfMonth = new Date(currentYear, monthIndex, 1);
            const endOfMonth = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
            dateQuery = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };
        } else if (startDate && endDate) {
            dateQuery = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        } else {
            // Default to current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            dateQuery = { createdAt: { $gte: startOfMonth, $lte: endOfMonth } };
        }

        query = { ...query, ...dateQuery };

        // Status filter
        if (status) {
            query.status = status;
        }

        // Calculate skip value for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get total count for pagination
        const totalDeals = await Deal.countDocuments(query);

        // Fetch deals with pagination and populate distributor information
        const deals = await Deal.find(query)
            .populate({
                path: 'commitments',
                populate: {
                    path: 'userId',
                    select: 'name email businessName'
                }
            })
            .populate({
                path: 'distributor',
                select: 'name email businessName'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Transform the data to include commitment counts
        const dealsWithStats = deals.map(deal => {
            const commitments = deal.commitments || [];
            let filteredCommitments = commitments;

            // Filter commitments by status if specified
            if (commitmentStatus) {
                filteredCommitments = commitments.filter(c => c.status === commitmentStatus);
            }

            const approvedCommitments = commitments.filter(c => c.status === 'approved');
            const pendingCommitments = commitments.filter(c => c.status === 'pending');

            // Calculate total quantity for each status
            const calcTotalQuantity = (commitArray) => {
                return commitArray.reduce((sum, c) => {
                    // If sizeCommitments exists, sum all sizes
                    if (c.sizeCommitments && c.sizeCommitments.length > 0) {
                        return sum + c.sizeCommitments.reduce((sizeSum, sizeItem) => 
                            sizeSum + sizeItem.quantity, 0);
                    }
                    // Fall back to regular quantity
                    return sum + (c.quantity || 0);
                }, 0);
            };

            const pendingTotalQuantity = calcTotalQuantity(pendingCommitments);
            const approvedTotalQuantity = calcTotalQuantity(approvedCommitments);

            return {
                _id: deal._id,
                name: deal.name,
                description: deal.description,
                size: deal.size,
                sizes: deal.sizes || [],
                originalCost: deal.originalCost,
                discountPrice: deal.discountPrice,
                minimumQuantity: deal.minQtyForDiscount,
                discountTiers: deal.discountTiers || [],
                category: deal.category,
                status: deal.status,
                distributor: deal.distributor,
                dealEndsAt: deal.dealEndsAt,
                bulkAction: deal.bulkAction,
                bulkStatus: deal.bulkStatus,
                createdAt: deal.createdAt,
                totalCommitments: commitments.length,
                pendingCommitments: commitments.filter(c => c.status === 'pending').length,
                approvedCommitments: commitments.filter(c => c.status === 'approved').length,
                declinedCommitments: commitments.filter(c => c.status === 'declined').length,
                
                totalPQuantity: pendingTotalQuantity,
                totalPAmount: pendingCommitments.reduce((sum, c) => sum + c.totalPrice, 0),
                totalQuantity: approvedTotalQuantity,
                totalAmount: approvedCommitments.reduce((sum, c) => sum + c.totalPrice, 0)
            };
        }).filter(deal => deal !== null); // Remove null values

        res.json({
            success: true,
            deals: dealsWithStats,
            pagination: {
                total: totalDeals,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalDeals / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching deals for admin:', error);
        res.status(500).json({ success: false, message: 'Error fetching deals' });
    }
});

// Bulk approve commitments for a deal
router.post('/bulk-approve-commitments', async (req, res) => {
    try {
        const { dealId, distributorId } = req.body;

        // Verify the deal belongs to the distributor
        const deal = await Deal.findOne({ _id: dealId, distributor: distributorId });
        if (!deal) {
            return res.status(403).json({ success: false, message: 'Unauthorized access' });
        }

        // Find all pending commitments for this deal
        const pendingCommitments = await Commitment.find({
            dealId: dealId,
            status: 'pending'
        }).populate('userId', 'name email businessName');

        // Update all pending commitments to approved
        const result = await Commitment.updateMany(
            {
                dealId: dealId,
                status: 'pending'
            },
            {
                $set: {
                    status: 'approved',
                    distributorResponse: 'Approved by distributor'
                }
            }
        );


        for (const commitment of pendingCommitments) {
            const userName = commitment.userId.businessName || commitment.userId.name;
            const userEmail = commitment.userId.email;

            const emailHtml = CommitmentNotificationTemplate.statusUpdate(
                userName,
                deal.name,
                'approved',
                commitment.quantity || 0,
                commitment.totalPrice,
                commitment.sizeCommitments
            );

            try {
                await sendEmail(userEmail, `Your Commitment for ${deal.name} has been Approved`, emailHtml);
            } catch (emailError) {
                console.error(`Failed to send email to ${userEmail}:`, emailError);
                // Continue with other emails even if one fails
            }
        }

        // Update the deal's total sold and revenue
        const commitments = await Commitment.find({ dealId: dealId, status: 'approved' });
        
        // Calculate totalSold properly accounting for sizeCommitments
        const totalSold = commitments.reduce((sum, c) => {
            // If sizeCommitments exists and has items, sum all sizes
            if (c.sizeCommitments && c.sizeCommitments.length > 0) {
                return sum + c.sizeCommitments.reduce((sizeSum, sizeItem) => 
                    sizeSum + sizeItem.quantity, 0);
            }
            // Otherwise, use the regular quantity field (or 0 if it doesn't exist)
            return sum + (c.quantity || 0);
        }, 0);
        
        const totalRevenue = commitments.reduce((sum, c) => sum + c.totalPrice, 0);

        const updatedDeal = await Deal.findByIdAndUpdate(dealId, {
            totalSold,
            totalRevenue,
            status: 'inactive',
            bulkAction: true,
            bulkStatus: 'approved'
        }, { new: true });

        // Broadcast real-time updates for the deal update
        if (updatedDeal) {
            broadcastDealUpdate(updatedDeal, 'updated');
            broadcastSingleDealUpdate(dealId, updatedDeal);
        }

        res.json({
            success: true,
            message: 'All pending commitments have been approved',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error bulk approving commitments:', error);
        res.status(500).json({ success: false, message: 'Error processing bulk approval' });
    }
});

// Bulk decline commitments for a deal
router.post('/bulk-decline-commitments', async (req, res) => {
    try {
        const { dealId, distributorId } = req.body;

        // Verify the deal belongs to the distributor
        const deal = await Deal.findOne({ _id: dealId, distributor: distributorId });
        if (!deal) {
            return res.status(403).json({ success: false, message: 'Unauthorized access' });
        }

        // Find all pending commitments for this deal
        const pendingCommitments = await Commitment.find({
            dealId: dealId,
            status: 'pending'
        }).populate('userId', 'name email businessName');

        // Update all pending commitments to declined
        const result = await Commitment.updateMany(
            {
                dealId: dealId,
                status: 'pending'
            },
            {
                $set: {
                    status: 'declined',
                    distributorResponse: 'Declined by distributor'
                }
            }
        );


        for (const commitment of pendingCommitments) {
            const userName = commitment.userId.businessName || commitment.userId.name;
            const userEmail = commitment.userId.email;

            const emailHtml = CommitmentNotificationTemplate.statusUpdate(
                userName,
                deal.name,
                'declined',
                commitment.quantity || 0,
                commitment.totalPrice,
                commitment.sizeCommitments
            );

            try {
                await sendEmail(userEmail, `Your Commitment for ${deal.name} has been Declined`, emailHtml);
            } catch (emailError) {
                console.error(`Failed to send email to ${userEmail}:`, emailError);
                // Continue with other emails even if one fails
            }
        }

        const updatedDeal = await Deal.findByIdAndUpdate(dealId, {
            status: 'inactive',
            bulkAction: true,
            bulkStatus: 'rejected'
        }, { new: true });

        // Broadcast real-time updates for the deal update
        if (updatedDeal) {
            broadcastDealUpdate(updatedDeal, 'updated');
            broadcastSingleDealUpdate(dealId, updatedDeal);
        }

        res.json({
            success: true,
            message: 'All pending commitments have been declined',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error bulk declining commitments:', error);
        res.status(500).json({ success: false, message: 'Error processing bulk decline' });
    }
});

// Get detailed commitments for a specific deal
router.get('/deal-commitments/:dealId', async (req, res) => {
    try {
        const { dealId } = req.params;
        const { distributorId } = req.query;

        // Base query for commitments
        const query = { dealId };

        // Check if request is from a distributor (if distributorId is provided)
        if (distributorId) {
            // Verify the deal belongs to the distributor
            const deal = await Deal.findOne({ _id: dealId, distributor: distributorId });
            if (!deal) {
                return res.status(403).json({ success: false, message: 'Unauthorized access' });
            }
        }

        const commitments = await Commitment.find(query)
            .populate('userId', 'name email businessName')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            commitments
        });
    } catch (error) {
        console.error('Error fetching deal commitments:', error);
        res.status(500).json({ success: false, message: 'Error fetching commitments' });
    }
});

// Update single commitment status
router.post('/update-commitment-status', async (req, res) => {
    try {
        const { commitmentId, status, distributorResponse, distributorId, adminAction } = req.body;

        // Fetch the commitment
        const commitment = await Commitment.findById(commitmentId)
            .populate('dealId')
            .populate('userId', 'name email businessName');

        if (!commitment) {
            return res.status(404).json({ success: false, message: 'Commitment not found' });
        }

        // If it's not an admin action, verify the deal belongs to the distributor
        if (!adminAction) {
            const deal = await Deal.findOne({
                _id: commitment.dealId._id,
                distributor: distributorId
            });

            if (!deal) {
                return res.status(403).json({ success: false, message: 'Unauthorized access' });
            }
        }

        // Update the commitment status
        commitment.status = status;
        commitment.distributorResponse = distributorResponse;
        await commitment.save();

        // Send email notification to the user
        const userName = commitment.userId.businessName || commitment.userId.name;
        const userEmail = commitment.userId.email;
        const dealName = commitment.dealId.name;

        const emailHtml = CommitmentNotificationTemplate.statusUpdate(
            userName,
            dealName,
            status,
            commitment.quantity || 0,
            commitment.totalPrice,
            commitment.sizeCommitments
        );

        try {
            await sendEmail(userEmail, `Your Commitment for ${dealName} has been ${status.charAt(0).toUpperCase() + status.slice(1)}`, emailHtml);
        } catch (emailError) {
            console.error(`Failed to send email to ${userEmail}:`, emailError);
            // Continue even if email fails
        }

        // If status is approved, update deal totals
        if (status === 'approved') {
            const approvedCommitments = await Commitment.find({
                dealId: commitment.dealId._id,
                status: 'approved'
            });

            // Calculate totalSold properly accounting for sizeCommitments
            const totalSold = approvedCommitments.reduce((sum, c) => {
                // If sizeCommitments exists and has items, sum all sizes
                if (c.sizeCommitments && c.sizeCommitments.length > 0) {
                    return sum + c.sizeCommitments.reduce((sizeSum, sizeItem) => 
                        sizeSum + sizeItem.quantity, 0);
                }
                // Otherwise, use the regular quantity field (or 0 if it doesn't exist)
                return sum + (c.quantity || 0);
            }, 0);
            
            const totalRevenue = approvedCommitments.reduce((sum, c) => sum + c.totalPrice, 0);

            await Deal.findByIdAndUpdate(commitment.dealId._id, {
                totalSold,
                totalRevenue
            });
        }

        res.json({
            success: true,
            message: `Commitment status updated to ${status}`,
            commitment
        });
    } catch (error) {
        console.error('Error updating commitment status:', error);
        res.status(500).json({ success: false, message: 'Error updating commitment status' });
    }
});

module.exports = router;
