const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const { isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get recent deals and commitments (admin only)
router.get('/recent', isAdmin, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const adminId = currentUser.id;

        // Get 5 most recent deals
        const recentDeals = await Deal.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('distributor', 'name businessName');

        // Get 5 most recent commitments
        const recentCommitments = await Commitment.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('userId', 'name businessName')
            .populate('dealId', 'name description');

        // Log the action
        await logCollaboratorAction(req, 'view_recent_activity', 'recent data', { 
            recentDeals: recentDeals.length,
            recentCommitments: recentCommitments.length,
            additionalInfo: 'Admin viewed recent deals and commitments activity'
        });

        res.json({
            success: true,
            recentDeals,
            recentCommitments
        });
    } catch (error) {
        console.error('Error fetching recent data:', error);
        
        // Log the error
        await logError(req, 'view_recent_activity', 'recent data', error);
        
        res.status(500).json({
            success: false,
            message: "Error fetching recent data",
            error: error.message
        });
    }
});

module.exports = router;
