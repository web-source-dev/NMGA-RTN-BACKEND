const express = require('express');
const router = express.Router();
const Commitment = require('../../models/Commitments');

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

        res.json({
            commitments,
            currentPage: page,
            totalPages: Math.ceil(totalCommitments / limit),
            totalCommitments
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching commitments', error: error.message });
    }
});

module.exports = router;
