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

    // Validate price relationship if both prices are being updated
    if (updateData.originalCost && updateData.discountPrice) {
      if (Number(updateData.discountPrice) >= Number(updateData.originalCost)) {
        return res.status(400).json({ 
          message: 'Discount price must be less than original cost' 
        });
      }
    } else if (updateData.discountPrice) {
      // If only discount price is being updated, check against existing original cost
      const existingDeal = await Deal.findById(dealId);
      if (Number(updateData.discountPrice) >= existingDeal.originalCost) {
        return res.status(400).json({ 
          message: 'Discount price must be less than original cost' 
        });
      }
    }

    // Ensure images array is properly handled
    if ('images' in updateData) {
      updateData.images = Array.isArray(updateData.images) ? 
        updateData.images.filter(url => url && typeof url === 'string') : 
        [];
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

    // Broadcast real-time update
    broadcastDealUpdate(deal, 'updated');
    broadcastSingleDealUpdate(dealId, deal);

    // Create notification for members who have favorited or committed to this deal
    const notificationMessage = `Deal "${deal.name}" has been updated. Changes: ${Object.keys(updateData).join(', ')}`;
    
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
