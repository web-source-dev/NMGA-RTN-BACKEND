const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const { broadcastDealUpdate, broadcastSingleDealUpdate } = require('../../utils/dealUpdates');
const { isDistributorAdmin, getCurrentUserContext, isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

router.patch('/:dealId/status', isDistributorAdmin, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const deal = await Deal.findByIdAndUpdate(dealId, { status }, { new: true })
      .populate('distributor', 'name _id');
      
    if (!deal) {
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

    await logCollaboratorAction(req, 'update_deal_status', 'deal', { 
      dealId: dealId,
      dealName: deal.name,
      oldStatus: deal.status,
      newStatus: status,
      additionalInfo: `Deal status changed from ${deal.status} to ${status}`
    });
    res.status(200).json(deal);
  } catch (err) {
    console.error(err);
    await logError(req, 'update_deal_status', 'deal', err, {
      dealId: req.params.dealId,
      status: req.body.status
    });
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:dealId/status/admin', isAdmin, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID' });
    }

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const deal = await Deal.findByIdAndUpdate(dealId, { status }, { new: true })
      .populate('distributor', 'name _id');
      
    if (!deal) {
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

    await logCollaboratorAction(req, 'update_deal_status_admin', 'deal', { 
      dealId: dealId,
      dealName: deal.name,
      oldStatus: deal.status,
      newStatus: status,
      additionalInfo: `Admin changed deal status from ${deal.status} to ${status}`
    });
    res.status(200).json(deal);
  } catch (err) {
    console.error(err);
    await logError(req, 'update_deal_status_admin', 'deal', err, {
      dealId: req.params.dealId,
      status: req.body.status
    });
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
