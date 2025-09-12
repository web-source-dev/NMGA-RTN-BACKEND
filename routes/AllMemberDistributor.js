const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Deal = require('../models/Deals');
const Commitment = require('../models/Commitments');
const Log = require('../models/Logs');
const { isDistributorAdmin, getCurrentUserContext } = require('../middleware/auth');
const { logCollaboratorAction } = require('../utils/collaboratorLogger');

// Get all members who have committed to a distributor's deals
router.get('/members', isDistributorAdmin, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const distributorId = currentUser.id;

        // Find all deals by this distributor
        const distributorDeals = await Deal.find({ distributor: distributorId });
        const dealIds = distributorDeals.map(deal => deal._id);

        // Find all commitments for these deals
        const commitments = await Commitment.find({
            dealId: { $in: dealIds }
        }).populate('userId');

        // Group commitments by user and calculate statistics
        const memberStats = {};
        commitments.forEach(commitment => {
            // Skip commitments with null or missing userId
            if (!commitment.userId || !commitment.userId._id) {
                console.warn('Skipping commitment with missing userId:', commitment._id);
                return;
            }
            
            if (!memberStats[commitment.userId._id]) {
                memberStats[commitment.userId._id] = {
                    member: commitment.userId,
                    totalCommitments: 0,
                    totalSpent: 0,
                    quantity: 0,
                    lastCommitment: null
                };
            }
            memberStats[commitment.userId._id].totalCommitments++;
            memberStats[commitment.userId._id].totalSpent += commitment.totalPrice;
            
            // Calculate total quantity from all size commitments
            const totalQuantity = commitment.sizeCommitments.reduce((sum, sizeCommit) => sum + sizeCommit.quantity, 0);
            memberStats[commitment.userId._id].quantity += totalQuantity;
            
            // Track the most recent commitment
            if (!memberStats[commitment.userId._id].lastCommitment ||
                new Date(commitment.createdAt) > new Date(memberStats[commitment.userId._id].lastCommitment)) {
                memberStats[commitment.userId._id].lastCommitment = commitment.createdAt;
            }
        });

        const memberList = Object.values(memberStats);

        await logCollaboratorAction(req, 'view_distributor_members', 'members', { 
            totalMembers: memberList.length,
            additionalInfo: `Viewed distributor members - Found ${memberList.length} members`
        });

        res.json({
            success: true,
            data: memberList
        });
    } catch (error) {
        console.error('Error fetching members:', error);
        
        await logCollaboratorAction(req, 'view_distributor_members_failed', 'members', { 
            additionalInfo: `Error: ${error.message}`
        });
        
        res.status(500).json({
            success: false,
            message: 'Error fetching members',
            error: error.message
        });
    }
});

// Get detailed commitment history for a specific member
router.get('/member/:memberId', isDistributorAdmin, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const distributorId = currentUser.id;
        const { memberId } = req.params;

        // Find all deals by this distributor
        const distributorDeals = await Deal.find({ distributor: distributorId });
        const dealIds = distributorDeals.map(deal => deal._id);

        // Find all commitments for these deals by the specific member
        const memberCommitments = await Commitment.find({
            dealId: { $in: dealIds },
            userId: memberId
        }).populate('dealId');

        // Get member details
        const memberDetails = await User.findById(memberId);

        await logCollaboratorAction(req, 'view_distributor_member_details', 'member', { 
            memberId: memberId,
            memberName: memberDetails?.name,
            totalCommitments: memberCommitments.length,
            additionalInfo: `Viewed member details for "${memberDetails?.name}" (${memberCommitments.length} commitments)`
        });

        res.json({
            success: true,
            data: {
                member: memberDetails,
                commitments: memberCommitments
            }
        });
    } catch (error) {
        console.error('Error fetching member details:', error);
        
        await logCollaboratorAction(req, 'view_distributor_member_details_failed', 'member', { 
            memberId: req.params.memberId,
            additionalInfo: `Error: ${error.message}`
        });
        
        res.status(500).json({
            success: false,
            message: 'Error fetching member details',
            error: error.message
        });
    }
});

// Get top members by commitment value
router.get('/top-members', isDistributorAdmin, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const distributorId = currentUser.id;
        const { limit = 10 } = req.query;

        // Find all deals by this distributor
        const distributorDeals = await Deal.find({ distributor: distributorId });
        const dealIds = distributorDeals.map(deal => deal._id);

        // Find all commitments for these deals
        const commitments = await Commitment.find({
            dealId: { $in: dealIds }
        }).populate('userId');

        // Group and calculate total spent by each member
        const memberStats = {};
        commitments.forEach(commitment => {
            // Skip commitments with null or missing userId
            if (!commitment.userId || !commitment.userId._id) {
                console.warn('Skipping commitment with missing userId:', commitment._id);
                return;
            }
            
            if (!memberStats[commitment.userId._id]) {
                memberStats[commitment.userId._id] = {
                    member: commitment.userId,
                    totalCommitments: 0,
                    quantity: 0,
                    totalSpent: 0
                };
            }
            memberStats[commitment.userId._id].totalCommitments++;
            memberStats[commitment.userId._id].totalSpent += commitment.totalPrice;
            
            // Calculate total quantity from all size commitments
            const totalQuantity = commitment.sizeCommitments.reduce((sum, sizeCommit) => sum + sizeCommit.quantity, 0);
            memberStats[commitment.userId._id].quantity += totalQuantity;
        });

        // Convert to array and sort by total spent
        const sortedMembers = Object.values(memberStats)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, parseInt(limit));

        await logCollaboratorAction(req, 'view_distributor_top_members', 'members', { 
            totalMembers: sortedMembers.length,
            limit: parseInt(limit),
            additionalInfo: `Viewed top ${sortedMembers.length} members (limit: ${limit})`
        });

        res.json({
            success: true,
            data: sortedMembers
        });
    } catch (error) {
        console.error('Error fetching top members:', error);
        
        await logCollaboratorAction(req, 'view_distributor_top_members_failed', 'members', { 
            additionalInfo: `Error: ${error.message}`
        });
        
        res.status(500).json({
            success: false,
            message: 'Error fetching top members',
            error: error.message
        });
    }
});

module.exports = router;