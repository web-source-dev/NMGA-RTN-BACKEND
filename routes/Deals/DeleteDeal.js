const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const Log = require('../../models/Logs');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const { broadcastDealUpdate } = require('../../utils/dealUpdates');

router.delete('/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;

    // Find the deal
    const deal = await Deal.findById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: 'Deal not found'
      });
    }

    // Check for existing commitments
    const commitments = await mongoose.model('Commitment').find({ dealId});
    if (commitments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this deal as it has active commitments'
      });
    }

    // Delete the deal
    await Deal.findByIdAndDelete(dealId);

    // Create a log entry
    await Log.create({
      type: 'info',
      message: `Deal "${deal.name}" has been deleted`,
    });

    // Broadcast deal deletion
    broadcastDealUpdate({...deal.toObject(), _id: deal._id.toString()}, 'deleted');

    // Send success response
    res.status(200).json({
      success: true,
      message: `Deal "${deal.name}" has been successfully deleted`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the deal'
    });
  }
});

module.exports = router;
