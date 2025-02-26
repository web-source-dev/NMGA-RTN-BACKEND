const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');

router.get('/deal/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    // Increment views counter and populate distributor info with additional fields
    const deal = await Deal.findByIdAndUpdate(
      dealId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('distributor', 'name email businessName contactPerson phone logo');

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Add log entry for deal view with enhanced information
    await Log.create({
      message: `Deal "${deal.name}" viewed - Views: ${deal.views}, Impressions: ${deal.impressions}, Original Cost: $${deal.originalCost}, Discount Price: $${deal.discountPrice}, Min Qty for Discount: ${deal.minQtyForDiscount}`,
      type: 'info',
      user_id: deal.distributor._id
    });

    // Calculate savings information
    const savingsPerUnit = deal.originalCost - deal.discountPrice;
    const savingsPercentage = ((savingsPerUnit / deal.originalCost) * 100).toFixed(2);

    // Add calculated fields to response
    const response = {
      ...deal.toObject(),
      savingsPerUnit,
      savingsPercentage,
      totalPotentialSavings: savingsPerUnit * deal.minQtyForDiscount
    };

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
