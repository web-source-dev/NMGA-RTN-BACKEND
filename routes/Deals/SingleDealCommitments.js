const express = require('express');
const router = express.Router();
const Commitment = require('../../models/Commitments');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Get all commitments for a specific deal
router.get('/:dealId', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalCommitments = await Commitment.countDocuments({ dealId: req.params.dealId });
        const commitments = await Commitment.find({ dealId: req.params.dealId })
            .populate('userId', 'name email businessName phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        await logCollaboratorAction(req, 'view_deal_commitments', 'commitments', { 
            dealId: req.params.dealId,
            totalCommitments: totalCommitments,
            currentPage: page,
            totalPages: Math.ceil(totalCommitments / limit),
            additionalInfo: `Viewed commitments for deal with pagination`
        });
        
        res.json({
            commitments,
            currentPage: page,
            totalPages: Math.ceil(totalCommitments / limit),
            totalCommitments
        });
    } catch (error) {
        await logCollaboratorAction(req, 'view_deal_commitments_failed', 'commitments', { 
            dealId: req.params.dealId,
            additionalInfo: `Error: ${error.message}`
        });
        res.status(500).json({ message: 'Error fetching commitments', error: error.message });
    }
});

module.exports = router;
