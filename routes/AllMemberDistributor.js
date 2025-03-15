const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Deal = require('../models/Deals');
const Commitment = require('../models/Commitments');

// Get all members who have committed to a distributor's deals
router.get('/:distributorId/members', async (req, res) => {
    try {
        const { distributorId } = req.params;

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
            memberStats[commitment.userId._id].quantity += commitment.quantity;
            
            // Track the most recent commitment
            if (!memberStats[commitment.userId._id].lastCommitment ||
                new Date(commitment.createdAt) > new Date(memberStats[commitment.userId._id].lastCommitment)) {
                memberStats[commitment.userId._id].lastCommitment = commitment.createdAt;
            }
        });

        const memberList = Object.values(memberStats);

        res.json({
            success: true,
            data: memberList
        });
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching members',
            error: error.message
        });
    }
});

// Get detailed commitment history for a specific member
router.get('/:distributorId/member/:memberId', async (req, res) => {
    try {
        const { distributorId, memberId } = req.params;

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

        res.json({
            success: true,
            data: {
                member: memberDetails,
                commitments: memberCommitments
            }
        });
    } catch (error) {
        console.error('Error fetching member details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching member details',
            error: error.message
        });
    }
});

// Get top members by commitment value
router.get('/:distributorId/top-members', async (req, res) => {
    try {
        const { distributorId } = req.params;
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
            memberStats[commitment.userId._id].quantity += commitment.quantity;
        });

        // Convert to array and sort by total spent
        const sortedMembers = Object.values(memberStats)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, parseInt(limit));

        res.json({
            success: true,
            data: sortedMembers
        });
    } catch (error) {
        console.error('Error fetching top members:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching top members',
            error: error.message
        });
    }
});

module.exports = router;