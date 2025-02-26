const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');

router.delete('/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      await Log.create({
        message: `Warning: Invalid deal information provided for deletion`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    const deal = await Deal.findById(dealId).populate('distributor', 'name _id');
    if (!deal) {
      await Log.create({
        message: `Warning: Attempt to delete non-existent deal`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Find all users who have committed to or favorited this deal
    const commitments = await mongoose.model('Commitment').find({ 
      dealId: deal._id,
      status: { $ne: 'cancelled' }
    }).distinct('userId');

    const favorites = await mongoose.model('Favorite').find({ 
      dealId: deal._id 
    }).distinct('userId');

    // Combine and deduplicate user IDs
    const affectedUsers = [...new Set([...commitments, ...favorites])];

    // Notify all affected users
    for (const userId of affectedUsers) {
      await createNotification({
        recipientId: userId,
        senderId: deal.distributor._id,
        type: 'deal',
        subType: 'deal_deleted',
        title: 'Deal Deleted',
        message: `Deal "${deal.name}" has been deleted by the distributor`,
        relatedId: deal._id,
        onModel: 'Deal',
        priority: 'high'
      });
    }

    // Notify admin about the deletion
    await notifyUsersByRole('admin', {
      type: 'deal',
      subType: 'deal_deleted',
      title: 'Deal Deleted',
      message: `Distributor ${deal.distributor.name} has deleted deal "${deal.name}"`,
      relatedId: deal._id,
      onModel: 'Deal',
      priority: 'medium'
    });

    await deal.deleteOne();
    res.status(200).json({ message: 'Deal deleted successfully' });
    
    await Log.create({ 
      message: `Deal "${deal.name}" permanently deleted by distributor`, 
      type: 'info', 
      user_id: deal.distributor._id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
