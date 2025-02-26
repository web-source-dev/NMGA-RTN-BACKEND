const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');

// Get recent deals and commitments
router.get('/recent', async (req, res) => {
    try {
        // Get 10 most recent deals
        const recentDeals = await Deal.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('distributor', 'name businessName');

        // Get 10 most recent commitments
        const recentCommitments = await Commitment.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'name businessName')
            .populate('dealId', 'name description');

        res.json({
            success: true,
            recentDeals,
            recentCommitments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching recent data",
            error: error.message
        });
    }
});

module.exports = router;
