const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const { broadcastDealUpdate, broadcastSingleDealUpdate } = require('../../utils/dealUpdates');

router.put('/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      await Log.create({
        message: `Warning: Invalid deal information provided for update`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    // Validate sizes if provided
    if (updateData.sizes) {
      if (!Array.isArray(updateData.sizes) || updateData.sizes.length === 0) {
        return res.status(400).json({
          message: 'At least one size must be specified'
        });
      }

      // Validate each size
      for (const sizeObj of updateData.sizes) {
        if (!sizeObj.size || !sizeObj.originalCost || !sizeObj.discountPrice) {
          return res.status(400).json({
            message: 'Each size must include size name, original cost, and discount price'
          });
        }

        // Validate price relationship for each size
        if (Number(sizeObj.discountPrice) >= Number(sizeObj.originalCost)) {
          return res.status(400).json({
            message: `Discount price must be less than original cost for size ${sizeObj.size}`
          });
        }
      }
    }

    // Validate discount tiers if provided
    if (updateData.discountTiers) {
      if (!Array.isArray(updateData.discountTiers)) {
        return res.status(400).json({
          message: 'Discount tiers must be an array'
        });
      }

      if (updateData.discountTiers.length > 0) {
        // Get the minimum quantity from either the update data or the existing deal
        let minQty;
        if (updateData.minQtyForDiscount) {
          minQty = Number(updateData.minQtyForDiscount);
        } else {
          const existingDeal = await Deal.findById(dealId);
          minQty = existingDeal.minQtyForDiscount;
        }

        // Sort tiers by quantity to ensure proper progression
        updateData.discountTiers.sort((a, b) => a.tierQuantity - b.tierQuantity);
        
        // Check that first tier is greater than min quantity
        if (updateData.discountTiers[0].tierQuantity <= minQty) {
          return res.status(400).json({
            message: 'First discount tier quantity must be greater than minimum quantity for discount'
          });
        }
        
        // Check that tiers increase in quantity and discount percentage
        for (let i = 1; i < updateData.discountTiers.length; i++) {
          if (updateData.discountTiers[i].tierQuantity <= updateData.discountTiers[i-1].tierQuantity) {
            return res.status(400).json({
              message: 'Discount tier quantities must increase with each tier'
            });
          }
          
          if (updateData.discountTiers[i].tierDiscount <= updateData.discountTiers[i-1].tierDiscount) {
            return res.status(400).json({
              message: 'Discount percentages must increase with each tier'
            });
          }
        }
      }
    }

    // Ensure images array is properly handled
    if ('images' in updateData) {
      updateData.images = Array.isArray(updateData.images) ? 
        updateData.images.filter(url => url && typeof url === 'string') : 
        [];
    }

    // Ensure commitment dates are properly handled
    if (updateData.commitmentStartAt) {
      updateData.commitmentStartAt = new Date(updateData.commitmentStartAt);
    }
    if (updateData.commitmentEndsAt) {
      updateData.commitmentEndsAt = new Date(updateData.commitmentEndsAt);
    }

    // Use $set to ensure arrays are replaced rather than merged
    const deal = await Deal.findByIdAndUpdate(
      dealId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('distributor', 'name _id');

    if (!deal) {
      await Log.create({
        message: `Warning: Attempt to update non-existent deal`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Calculate average discount percentage across sizes for notification
    let notificationText = '';
    if (deal.sizes && deal.sizes.length > 0) {
      const avgOriginalCost = deal.sizes.reduce((sum, size) => sum + Number(size.originalCost), 0) / deal.sizes.length;
      const avgDiscountPrice = deal.sizes.reduce((sum, size) => sum + Number(size.discountPrice), 0) / deal.sizes.length;
      const avgSavingsPercentage = (((avgOriginalCost - avgDiscountPrice) / avgOriginalCost) * 100).toFixed(2);
      notificationText = ` Average discount: ${avgSavingsPercentage}%`;
    }

    // Broadcast real-time update
    broadcastDealUpdate(deal, 'updated');
    broadcastSingleDealUpdate(dealId, deal);

    // Create notification for members who have favorited or committed to this deal
    const notificationMessage = `Deal "${deal.name}" has been updated.${notificationText} Changes: ${Object.keys(updateData).join(', ')}`;
    
    // Notify members who have committed to this deal
    const commitments = await mongoose.model('Commitment').find({ dealId: deal._id, status: { $ne: 'cancelled' } })
      .distinct('userId');
    
    for (const userId of commitments) {
      await createNotification({
        recipientId: userId,
        senderId: deal.distributor._id,
        type: 'deal',
        subType: 'deal_updated',
        title: 'Deal Updated',
        message: notificationMessage,
        relatedId: deal._id,
        onModel: 'Deal',
        priority: 'high'
      });
    }

    // Notify admin about the update
    await notifyUsersByRole('admin', {
      type: 'deal',
      subType: 'deal_updated',
      title: 'Deal Updated',
      message: `Distributor ${deal.distributor.name} has updated deal "${deal.name}"`,
      relatedId: deal._id,
      onModel: 'Deal',
      priority: 'medium'
    });

    await Log.create({
      message: `Deal "${deal.name}" updated - Modified: ${Object.keys(updateData).join(', ')}`,
      type: 'info',
      user_id: req.user?.id
    });
    res.status(200).json(deal);
  } catch (err) {
    const deal = await Deal.findById(req.params.dealId);
    const dealName = deal ? deal.name : 'unknown deal';
    await Log.create({
      message: `Failed to update deal "${dealName}" - Error: ${err.message}`,
      type: 'error',
      user_id: req.user?.id
    });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
