const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');

router.get('/', async (req, res) => {
    try {
        // Get the latest 4 active deals with more details
        const latestDeals = await Deal.find({ status: 'active' })
            .sort({ createdAt: -1 })
            .limit(3)
            .populate('distributor', 'businessName logo')
            .populate({
                path: 'commitments',
                select: 'quantity'
            })
            .select('name description discountPrice originalCost images category minQtyForDiscount dealEndsAt views');

        // Calculate total committed quantity for each deal
        const dealsWithCommitments = latestDeals.map(deal => {
            const totalCommittedQty = deal.commitments.reduce((sum, commitment) => 
                sum + commitment.quantity, 0
            );
            
            // Convert to plain object to add new properties
            const dealObj = deal.toObject();
            dealObj.totalCommittedQty = totalCommittedQty;
            delete dealObj.commitments; // Remove raw commitment data
            
            return dealObj;
        });

        res.json({
            success: true,
            deals: dealsWithCommitments
        });
    } catch (error) {
        console.error('Error fetching latest deals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching latest deals',
            error: error.message
        });
    }
});

module.exports = router;
