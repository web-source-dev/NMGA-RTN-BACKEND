const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const newDealTemplate = require('../../utils/EmailTemplates/NewDealTemplate');
const { sendDealMessage } = require('../../utils/message');
const { notifyUsersByRole } = require('../Common/Notification');
const { broadcastDealUpdate } = require('../../utils/dealUpdates');

// Create a new deal
router.post('/create', async (req, res) => {
  try {
    const {
      name,
      description,
      sizes,
      category,
      dealEndsAt,
      dealStartAt,
      commitmentStartAt,
      commitmentEndsAt,
      singleStoreDeals,
      distributor,
      minQtyForDiscount,
      discountTiers,
      images
    } = req.body;
    
    console.log(req.body);

    // Validate required fields
    if (!name || !distributor || !dealEndsAt || !dealStartAt || !sizes || !sizes.length || !minQtyForDiscount) {
      return res.status(400).json({
        message: 'Missing required fields'
      });
    }

    // Validate sizes data
    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({
        message: 'At least one size must be specified'
      });
    }

    // Validate each size
    for (const sizeObj of sizes) {
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

    // Validate discount tiers if provided
    if (discountTiers && Array.isArray(discountTiers) && discountTiers.length > 0) {
      // Sort tiers by quantity to ensure proper progression
      discountTiers.sort((a, b) => a.tierQuantity - b.tierQuantity);
      
      // Check that first tier is greater than min quantity
      if (discountTiers[0].tierQuantity <= minQtyForDiscount) {
        return res.status(400).json({
          message: 'First discount tier quantity must be greater than minimum quantity for discount'
        });
      }
      
      // Check that tiers increase in quantity and discount percentage
      for (let i = 1; i < discountTiers.length; i++) {
        if (discountTiers[i].tierQuantity <= discountTiers[i-1].tierQuantity) {
          return res.status(400).json({
            message: 'Discount tier quantities must increase with each tier'
          });
        }
        
        if (discountTiers[i].tierDiscount >= discountTiers[i-1].tierDiscount) {
          return res.status(400).json({
            message: 'Discount prices must decrease with each tier'
          });
        }
      }
    }

    // Validate minimum quantity
    if (Number(minQtyForDiscount) < 1) {
      return res.status(400).json({
        message: 'Minimum quantity for discount must be at least 1'
      });
    }

    // Validate deal dates
    const startDate = new Date(dealStartAt);
    const endDate = new Date(dealEndsAt);

    if (endDate <= startDate) {
      return res.status(400).json({
        message: 'Deal end date must be after start date'
      });
    }
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
      sizes,
      category,
      dealEndsAt,
      dealStartAt,
      commitmentStartAt,
      commitmentEndsAt,
      singleStoreDeals,
      distributor,
      minQtyForDiscount: Number(minQtyForDiscount),
      discountTiers: discountTiers || [],
      images: Array.isArray(images) ? images.filter(url => url && typeof url === 'string') : [],
      status: 'active',
      views: 0,
      impressions: 0,
      totalSold: 0,
      totalRevenue: 0,
      commitments: [],
      notificationHistory: new Map()
    });

    // Broadcast real-time update for the new deal
    broadcastDealUpdate(newDeal, 'created');

    // Calculate average discount percentage across sizes
    const avgOriginalCost = sizes.reduce((sum, size) => sum + Number(size.originalCost), 0) / sizes.length;
    const avgDiscountPrice = sizes.reduce((sum, size) => sum + Number(size.discountPrice), 0) / sizes.length;
    const avgSavingsPerUnit = avgOriginalCost - avgDiscountPrice;
    const avgSavingsPercentage = ((avgSavingsPerUnit / avgOriginalCost) * 100).toFixed(2);

    // Create notifications for all members
    await notifyUsersByRole('member', {
      type: 'deal',
      subType: 'deal_created',
      title: 'New Deal Available',
      message: `New deal "${name}" is now available from ${user.name}. Average discount: ${avgSavingsPercentage}%`,
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
      message: `Distributor ${user.name} has created a new deal "${name}" with ${sizes.length} size options`,
      relatedId: newDeal._id,
      onModel: 'Deal',
      senderId: distributor,
      priority: 'medium'
    });

    // Create log entry
    await Log.create({
      message: `Distributor ${user.name} created new deal "${newDeal.name}" with ${sizes.length} size options and min quantity for discount ${newDeal.minQtyForDiscount} - Avg Savings: ${avgSavingsPercentage}%`,
      type: 'success',
      user_id: distributor
    });

    // Add calculated fields to response
    const response = {
      ...newDeal.toObject(),
      avgSavingsPerUnit,
      avgSavingsPercentage,
    };

    res.status(201).json(response);

    // Fetch all members
    const members = await User.find({ 
        role: 'member',
        isBlocked: false,
        email: { $exists: true, $ne: '' }
    }).select('name phone email').lean();

    // Send notifications to all members (SMS and Email)
    for (const member of members) {
        try {
            // Send email notification
            if (member.email) {
                const emailSubject = `New Deal: ${newDeal.name} by ${user.name}`;
                const emailContent = newDealTemplate(
                    newDeal.name, 
                    user.name, 
                    member.name, 
                    newDeal._id
                );
                await sendEmail(member.email, emailSubject, emailContent);
                console.log(`Email sent to ${member.name} at ${member.email}`);
            }

            // Send SMS notification if phone number exists
            if (member.phone) {
                const dealInfo = {
                    dealName: newDeal.name,
                    distributorName: user.name,
                    price: `${avgDiscountPrice.toFixed(2)} (avg)`,
                    expiryDate: newDeal.dealEndsAt,
                    minQuantity: newDeal.minQtyForDiscount,
                    sizeOptions: sizes.length
                };
                await sendDealMessage.newDeal(member.phone, dealInfo);
            }
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
