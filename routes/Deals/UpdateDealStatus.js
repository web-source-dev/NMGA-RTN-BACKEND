const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');
const User = require('../../models/User');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const { broadcastDealUpdate, broadcastSingleDealUpdate } = require('../../utils/dealUpdates');

router.patch('/:dealId/status', async (req, res) => {
  try {
    const { dealId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      await Log.create({
        message: `Warning: Invalid deal information provided for status update`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    if (!['active', 'inactive'].includes(status)) {
      await Log.create({
        message: `Warning: Invalid status "${status}" attempted for deal update`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(400).json({ message: 'Invalid status' });
    }

    const deal = await Deal.findByIdAndUpdate(dealId, { status }, { new: true })
      .populate('distributor', 'name _id');
      
    if (!deal) {
      await Log.create({
        message: `Warning: Attempt to update status of non-existent deal`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Broadcast real-time updates for status change
    broadcastDealUpdate(deal, 'updated');
    broadcastSingleDealUpdate(dealId, deal);

    // Notify members who have committed to this deal
    const commitments = await mongoose.model('Commitment').find({ 
      dealId: deal._id,
      status: { $ne: 'cancelled' }
    }).distinct('userId');

    for (const userId of commitments) {
      await createNotification({
        recipientId: userId,
        senderId: deal.distributor._id,
        type: 'deal',
        subType: 'deal_status_changed',
        title: 'Deal Status Changed',
        message: `Deal "${deal.name}" is now ${status}`,
        relatedId: deal._id,
        onModel: 'Deal',
        priority: status === 'inactive' ? 'high' : 'medium'
      });
    }

    // Notify admin about the status change
    await notifyUsersByRole('admin', {
      type: 'deal',
      subType: 'deal_status_changed',
      title: 'Deal Status Changed',
      message: `Distributor ${deal.distributor.name} has changed deal "${deal.name}" status to ${status}`,
      relatedId: deal._id,
      onModel: 'Deal',
      priority: 'medium'
    });

    await Log.create({
      message: `Deal "${deal.name}" status changed from ${deal.status} to ${status}`,
      type: 'info',
      user_id: req.user?.id
    });
    res.status(200).json(deal);
  } catch (err) {
    const deal = await Deal.findById(req.params.dealId);
    const dealName = deal ? deal.name : 'unknown deal';
    await Log.create({
      message: `Failed to update status of deal "${dealName}" - Error: ${err.message}`,
      type: 'error',
      user_id: req.user?.id
    });
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
