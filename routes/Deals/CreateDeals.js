const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const fs = require('fs');
const path = require('path');
const newDealTemplate = require('../../utils/EmailTemplates/NewDealTemplate');
const { sendDealMessage } = require('../../utils/message');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');

// Create a new deal
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      originalCost,
      discountPrice,
      minQtyForDiscount,
      size,
      images,
      category,
      dealEndsAt,
      distributor
    } = req.body;

    // Validate required fields
    if (!name || !originalCost || !discountPrice || !minQtyForDiscount || !distributor || !dealEndsAt) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }

    // Validate price relationship
    if (Number(discountPrice) >= Number(originalCost)) {
      return res.status(400).json({
        message: 'Discount price must be less than original cost'
      });
    }

    // Validate minimum quantity
    if (Number(minQtyForDiscount) < 1) {
      return res.status(400).json({
        message: 'Minimum quantity for discount must be at least 1'
      });
    }

    // Validate deal end date
    const endDate = new Date(dealEndsAt);
    if (endDate <= new Date()) {
      return res.status(400).json({
        message: 'Deal end date must be in the future'
      });
    }

    // Get distributor information
    const user = await User.findById(distributor);
    if (!user) {
      return res.status(404).json({
        message: 'Distributor not found'
      });
    }

    // Create the deal with initial statistics
    const newDeal = await Deal.create({
      name,
      description,
      originalCost: Number(originalCost),
      discountPrice: Number(discountPrice),
      minQtyForDiscount: Number(minQtyForDiscount),
      size,
      images: Array.isArray(images) ? images.filter(url => url && typeof url === 'string') : [],
      category,
      dealEndsAt,
      distributor,
      status: 'active',
      views: 0,
      impressions: 0,
      totalSold: 0,
      totalRevenue: 0,
      commitments: [],
      notificationHistory: new Map()
    });

    // Create notifications for all members
    await notifyUsersByRole('member', {
      type: 'deal',
      subType: 'deal_created',
      title: 'New Deal Available',
      message: `New deal "${name}" is now available from ${user.name}. Price: $${discountPrice} (Original: $${originalCost})`,
      relatedId: newDeal._id,
      onModel: 'Deal',
      senderId: distributor,
      priority: 'high'
    });

    // Notify admin about new deal
    await notifyUsersByRole('admin', {
      type: 'deal',
      subType: 'deal_created',
      title: 'New Deal Created',
      message: `Distributor ${user.name} has created a new deal "${name}"`,
      relatedId: newDeal._id,
      onModel: 'Deal',
      senderId: distributor,
      priority: 'medium'
    });

    // Calculate savings information
    const savingsPerUnit = newDeal.originalCost - newDeal.discountPrice;
    const savingsPercentage = ((savingsPerUnit / newDeal.originalCost) * 100).toFixed(2);

    // Create log entry
    await Log.create({
      message: `Distributor ${user.name} created new deal "${newDeal.name}" with min quantity for discount ${newDeal.minQtyForDiscount} - Savings: ${savingsPercentage}% ($${savingsPerUnit} per unit)`,
      type: 'success',
      user_id: distributor
    });

    // Add calculated fields to response
    const response = {
      ...newDeal.toObject(),
      savingsPerUnit,
      savingsPercentage,
      totalPotentialSavings: savingsPerUnit * newDeal.minQtyForDiscount
    };

    res.status(201).json(response);

    // Fetch all members
    const members = await User.find({ 
        role: 'member',
        isBlocked: false,
        phone: { $exists: true, $ne: '' }
    }).select('name phone email').lean();

    // Send notifications to all members
    for (const member of members) {
        try {
            const dealInfo = {
                dealName: newDeal.name,
                distributorName: user.name,
                price: newDeal.discountPrice,
                expiryDate: newDeal.dealEndsAt,
                minQuantity: newDeal.minQtyForDiscount
            };
            await sendDealMessage.newDeal(member.phone, dealInfo);
        } catch (error) {
            console.error(`Failed to send deal notification to ${member.name}:`, error);
        }
    }

  } catch (error) {
    console.error('Error creating deal:', error);
    await Log.create({
      message: `Failed to create deal - Error: ${error.message}`,
      type: 'error',
      user_id: req.body.distributor
    });
    res.status(500).json({
      message: 'Error creating deal'
    });
  }
});

module.exports = router;
