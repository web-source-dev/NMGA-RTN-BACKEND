const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');
const Supplier = require('../../models/Suppliers');

router.get('/deal/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    const userId = req.query.userId; // Get the logged-in user's ID from query params

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    // Increment views counter and populate distributor info with additional fields
    const deal = await Deal.findOne({
      _id: dealId,
    }).populate('distributor', 'name email businessName contactPerson phone logo');

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found or not currently active' });
    }

    // Increment the views counter
    deal.views += 1;
    await deal.save();

    // Add log entry for deal view with enhanced information
    const avgOriginalCost = deal.sizes.reduce((sum, size) => sum + Number(size.originalCost), 0) / deal.sizes.length;
    const avgDiscountPrice = deal.sizes.reduce((sum, size) => sum + Number(size.discountPrice), 0) / deal.sizes.length;
    
    await Log.create({
      message: `Deal "${deal.name}" viewed - Views: ${deal.views}, Impressions: ${deal.impressions}, Avg Original: $${avgOriginalCost.toFixed(2)}, Avg Discount: $${avgDiscountPrice.toFixed(2)}, Sizes: ${deal.sizes.length}`,
      type: 'info',
      user_id: deal.distributor._id
    });

    // Calculate average savings information
    const avgSavingsPerUnit = avgOriginalCost - avgDiscountPrice;
    const avgSavingsPercentage = ((avgSavingsPerUnit / avgOriginalCost) * 100).toFixed(2);

    // Get total commitments and quantity for this deal
    const commitmentStats = await Deal.aggregate([
      { $match: { 
          _id: new mongoose.Types.ObjectId(dealId),
        } 
      },
      {
        $lookup: {
          from: 'commitments',
          localField: 'commitments',
          foreignField: '_id',
          as: 'commitmentDetails'
        }
      },
      {
        $project: {
          totalCommitments: { $size: "$commitments" },
          commitmentDetails: 1
        }
      }
    ]);

    // Calculate total committed quantity across all size commitments
    let totalCommittedQuantity = 0;
    let sizeCommitments = {};
    
    if (commitmentStats.length > 0 && commitmentStats[0].commitmentDetails) {
      commitmentStats[0].commitmentDetails.forEach(commitment => {
        if (commitment.sizeCommitments && Array.isArray(commitment.sizeCommitments)) {
          commitment.sizeCommitments.forEach(sc => {
            totalCommittedQuantity += sc.quantity;
            
            // Track per-size commitments
            if (!sizeCommitments[sc.size]) {
              sizeCommitments[sc.size] = 0;
            }
            sizeCommitments[sc.size] += sc.quantity;
          });
        }
      });
    }

    // Check if there are suppliers assigned to this member by the deal's distributor
    let supplierInfo = [];
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      supplierInfo = await Supplier.find({
        assignedTo: { $in: [userId] },
        assignedBy: deal.distributor._id
      });
    }

    // Add calculated fields to response
    const response = {
      ...deal.toObject(),
      avgSavingsPerUnit,
      avgSavingsPercentage,
      totalPotentialSavings: avgSavingsPerUnit * deal.minQtyForDiscount,
      totalCommitments: commitmentStats[0]?.totalCommitments || 0,
      totalCommittedQuantity: totalCommittedQuantity,
      sizeCommitments: sizeCommitments,
      remainingQuantity: Math.max(0, deal.minQtyForDiscount - totalCommittedQuantity),
      supplierInfo: supplierInfo // Include supplier info in the response if available
    };

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
