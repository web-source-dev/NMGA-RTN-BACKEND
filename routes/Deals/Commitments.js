const express = require("express");
const Commitment = require("../../models/Commitments");
const Deal = require("../../models/Deals");
const Log = require("../../models/Logs");
const User = require('../../models/User');
const sendEmail = require('../../utils/email');
const { sendDealMessage } = require('../../utils/message');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const DailyCommitmentSummary = require('../../models/DailyCommitmentSummary');
const router = express.Router();

// Create a new commitment or update existing one (Get Deal)
router.post("/buy/:dealId", async (req, res) => {
  try {
    const { dealId } = req.params;
    const { userId, sizeCommitments } = req.body;

    if (!userId || !sizeCommitments || !Array.isArray(sizeCommitments) || sizeCommitments.length === 0) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "Please provide userId and sizeCommitments array" 
      });
    }
    
    // Validate each size commitment
    for (const sizeCommit of sizeCommitments) {
      if (!sizeCommit.size || !sizeCommit.quantity || sizeCommit.quantity <= 0) {
        return res.status(400).json({
          error: "Invalid size commitment",
          message: "Each size must include size name and quantity greater than 0"
        });
      }
    }

    const deal = await Deal.findById(dealId);
    const user = await User.findById(userId);

    if (!deal || !user) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Deal or user not found" 
      });
    }

    // Validate that each size in the commitment exists in the deal
    for (const sizeCommit of sizeCommitments) {
      const matchingSize = deal.sizes.find(s => s.size === sizeCommit.size);
      if (!matchingSize) {
        return res.status(400).json({
          error: "Invalid size",
          message: `Size "${sizeCommit.size}" does not exist in this deal`
        });
      }
    }

    // Calculate total quantity and price across all sizes
    let totalQuantity = 0;
    let totalPrice = 0;
    
    const processedSizeCommitments = sizeCommitments.map(sizeCommit => {
      const matchingSize = deal.sizes.find(s => s.size === sizeCommit.size);
      const quantityForSize = Number(sizeCommit.quantity);
      const pricePerUnit = Number(matchingSize.discountPrice);
      const totalPriceForSize = quantityForSize * pricePerUnit;
      
      totalQuantity += quantityForSize;
      totalPrice += totalPriceForSize;
      
      return {
        size: sizeCommit.size,
        quantity: quantityForSize,
        pricePerUnit: pricePerUnit,
        totalPrice: totalPriceForSize
      };
    });

    // Find if discount tier applies based on total quantity of all commitments for this deal
    let appliedDiscountTier = null;
    
    if (deal.discountTiers && deal.discountTiers.length > 0) {
      // Get total quantity committed to this deal (including existing commitments)
      const existingCommitments = await Commitment.find({
        dealId: dealId,
        status: { $ne: "cancelled" }
      });
      
      const existingTotalQuantity = existingCommitments.reduce((sum, commitment) => {
        // Add up quantities from sizeCommitments in each commitment
        if (commitment.sizeCommitments && Array.isArray(commitment.sizeCommitments)) {
          return sum + commitment.sizeCommitments.reduce((sizeSum, sc) => sizeSum + sc.quantity, 0);
        }
        return sum;
      }, 0);
      
      // Find the highest tier that would be reached with this new commitment
      const projectedTotalQuantity = existingTotalQuantity + totalQuantity;
      
      // Sort tiers by quantity in descending order to find the highest applicable tier
      const sortedTiers = [...deal.discountTiers].sort((a, b) => b.tierQuantity - a.tierQuantity);
      
      // Find highest applicable tier
      for (const tier of sortedTiers) {
        if (projectedTotalQuantity >= tier.tierQuantity) {
          appliedDiscountTier = tier;
          break;
        }
      }
      
      // Apply discount if a tier is applicable
      if (appliedDiscountTier) {
        const discountRate = appliedDiscountTier.tierDiscount / 100;
        
        // Recalculate prices with the discount
        totalPrice = 0;
        processedSizeCommitments.forEach(sizeCommit => {
          const originalTotal = sizeCommit.pricePerUnit * sizeCommit.quantity;
          const discountedPrice = sizeCommit.pricePerUnit * (1 - discountRate);
          sizeCommit.pricePerUnit = discountedPrice;
          sizeCommit.totalPrice = discountedPrice * sizeCommit.quantity;
          totalPrice += sizeCommit.totalPrice;
        });
      }
    }

    const distributor = await User.findById(deal.distributor);
    if (!distributor) {
      return res.status(404).json({
        error: "Not found",
        message: "Distributor not found"
      });
    }
    
    let commitment = await Commitment.findOne({
      userId: userId,
      dealId: dealId,
      status: { $ne: "cancelled" } 
    });
    
    let isNewCommitment = false;
    
    if (commitment) {
      commitment.sizeCommitments = processedSizeCommitments;
      commitment.totalPrice = totalPrice;
      commitment.status = "pending";
      commitment.modifiedByDistributor = false;
      commitment.modifiedSizeCommitments = [];
      commitment.modifiedTotalPrice = null;
      commitment.appliedDiscountTier = appliedDiscountTier;
      await commitment.save();
    } else {
      isNewCommitment = true;
      commitment = await Commitment.create({
        userId: userId,
        dealId: dealId,
        sizeCommitments: processedSizeCommitments,
        totalPrice,
        status: "pending",
        appliedDiscountTier
      });
      deal.commitments.push(commitment._id);
      await deal.save();
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let summary = await DailyCommitmentSummary.findOne({
      date: today,
      userId: userId,
      distributorId: deal.distributor
    });

    if (!summary) {
      summary = new DailyCommitmentSummary({
        date: today,
        userId: userId,
        distributorId: deal.distributor,
        commitments: [],
        totalCommitments: 0,
        totalQuantity: 0,
        totalAmount: 0
      });
    }

    // Remove previous commitment from summary if exists
    summary.commitments = summary.commitments.filter(c => c.commitmentId.toString() !== commitment._id.toString());
    
    // Add new commitment details with all sizes
    summary.commitments.push({
      commitmentId: commitment._id,
      dealId: dealId,
      sizeDetails: processedSizeCommitments.map(sc => ({
        size: sc.size,
        quantity: sc.quantity,
        pricePerUnit: sc.pricePerUnit,
        totalPrice: sc.totalPrice
      })),
      quantity: totalQuantity,
      totalPrice: totalPrice,
      dealName: deal.name,
      discountTierApplied: appliedDiscountTier ? 
        `${appliedDiscountTier.tierDiscount}% at ${appliedDiscountTier.tierQuantity}+ units` : 
        null
    });

    // Recalculate summary totals
    summary.totalQuantity = summary.commitments.reduce((sum, c) => sum + c.quantity, 0);
    summary.totalAmount = summary.commitments.reduce((sum, c) => sum + c.totalPrice, 0);
    summary.totalCommitments = summary.commitments.length;
    
    await summary.save();

    // Generate size details message for notifications
    const sizeDetailsMessage = processedSizeCommitments.map(sc => 
      `${sc.size}: ${sc.quantity} units at $${sc.pricePerUnit.toFixed(2)} each`
    ).join(', ');

    const discountMessage = appliedDiscountTier ? 
      ` with ${appliedDiscountTier.tierDiscount}% discount (Tier: ${appliedDiscountTier.tierQuantity}+ units)` : 
      '';

    await createNotification({
      recipientId: deal.distributor,
      senderId: userId,
      type: 'commitment',
      subType: 'commitment_created',
      title: 'New Deal Commitment',
      message: `${user.name} has committed to your deal "${deal.name}" - Total: ${totalQuantity} units, $${totalPrice.toFixed(2)}${discountMessage}. Size details: ${sizeDetailsMessage}`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'high'
    });

    await notifyUsersByRole('admin', {
      type: 'commitment',
      subType: 'commitment_created',
      title: 'New Deal Commitment',
      message: `${user.name} has committed to deal "${deal.name}" by distributor ${distributor.name} - Total: ${totalQuantity} units${discountMessage}`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'medium'
    });

    res.json({
      message: "Successfully committed to the deal",
      commitment,
      updatedDeal: deal,
    });
  } catch (error) {
    const deal = await Deal.findById(req.params.dealId);
    const user = await User.findById(req.body.userId);
    const dealName = deal ? deal.name : 'unknown deal';
    const userName = user ? user.name : 'unknown user';

    await Log.create({
      message: `Failed commitment by ${userName} to "${dealName}" - Error: ${error.message}`,
      type: 'error',
      user_id: req.body.userId
    });
    console.error("Error committing to deal:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while processing your request" 
    });
  }
});

// Update commitment status route
router.put("/update-status", async (req, res) => {
  try {
    const {
      commitmentId,
      status,
      distributorResponse,
      modifiedSizeCommitments
    } = req.body;

    // Validate the status
    const validStatuses = ["pending", "approved", "declined", "cancelled"];
    if (!validStatuses.includes(status)) {
      await Log.create({
        message: `Warning: Invalid status "${status}" attempted for commitment`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(400).json({
        error: "Invalid Status",
        message: "Status must be one of: pending, approved, declined, cancelled"
      });
    }

    // Find and populate the commitment with deal and user details
    const commitment = await Commitment.findById(commitmentId)
      .populate('dealId')
      .populate('userId');

    if (!commitment) {
      await Log.create({
        message: `Warning: Attempt to update non-existent commitment`,
        type: 'warning',
        user_id: req.user?.id
      });
      return res.status(404).json({
        error: "Not found",
        message: "Commitment not found"
      });
    }

    // Store old status for logging
    const oldStatus = commitment.status;

    // If modifying size commitments
    if (modifiedSizeCommitments && Array.isArray(modifiedSizeCommitments) && modifiedSizeCommitments.length > 0) {
      // Calculate new total quantities and verify all sizes exist in the deal
      let totalModifiedQuantity = 0;
      let totalModifiedPrice = 0;
      
      for (const sizeCommit of modifiedSizeCommitments) {
        // Verify size exists in the deal
        const matchingDealSize = commitment.dealId.sizes.find(s => s.size === sizeCommit.size);
        if (!matchingDealSize) {
          return res.status(400).json({
            error: "Invalid size",
            message: `Size "${sizeCommit.size}" does not exist in this deal`
          });
        }
        
        totalModifiedQuantity += sizeCommit.quantity;
        totalModifiedPrice += sizeCommit.quantity * sizeCommit.pricePerUnit;
      }
      
      // Validate against minimum quantity
      if (totalModifiedQuantity < commitment.dealId.minQtyForDiscount) {
        return res.status(400).json({
          error: "Invalid quantity",
          message: `Total modified quantity (${totalModifiedQuantity}) must be at least ${commitment.dealId.minQtyForDiscount}`
        });
      }
      
      commitment.modifiedSizeCommitments = modifiedSizeCommitments;
      commitment.modifiedTotalPrice = totalModifiedPrice;
      commitment.modifiedByDistributor = true;
    }

    // Update commitment
    commitment.status = status;
    commitment.distributorResponse = distributorResponse || commitment.distributorResponse;
    
    await commitment.save();

    // Update deal statistics if commitment is approved
    if (status === 'approved') {
      const deal = await Deal.findById(commitment.dealId);
      if (deal) {
        // Use either modified quantities or original quantities
        const finalSizeCommitments = commitment.modifiedByDistributor ? 
          commitment.modifiedSizeCommitments : 
          commitment.sizeCommitments;
          
        const finalTotalQuantity = finalSizeCommitments.reduce((sum, sc) => sum + sc.quantity, 0);
        const finalTotalPrice = commitment.modifiedByDistributor ? 
          commitment.modifiedTotalPrice : 
          commitment.totalPrice;
        
        deal.totalSold = (deal.totalSold || 0) + finalTotalQuantity;
        deal.totalRevenue = (deal.totalRevenue || 0) + finalTotalPrice;
        
        // Update notification history
        if (!deal.notificationHistory) {
          deal.notificationHistory = new Map();
        }
        const notificationEntry = {
          userId: commitment.userId._id,
          sentAt: new Date()
        };
        const userNotifications = deal.notificationHistory.get(commitment.userId._id.toString()) || [];
        userNotifications.push(notificationEntry);
        deal.notificationHistory.set(commitment.userId._id.toString(), userNotifications);
        
        await deal.save();
      }
    }
    
    // Generate size details message for notifications
    const generateSizeDetailsMessage = (sizeCommitments) => {
      return sizeCommitments.map(sc => 
        `${sc.size}: ${sc.quantity} units at $${sc.pricePerUnit.toFixed(2)} each`
      ).join(', ');
    };

    const originalSizeDetails = generateSizeDetailsMessage(commitment.sizeCommitments);
    const modifiedSizeDetails = commitment.modifiedByDistributor ? 
      generateSizeDetailsMessage(commitment.modifiedSizeCommitments) : null;

    const discountTierMessage = commitment.appliedDiscountTier ? 
      ` (with ${commitment.appliedDiscountTier.tierDiscount}% discount at ${commitment.appliedDiscountTier.tierQuantity}+ units)` : 
      '';

    // Create detailed log entry
    const logMessage = `Commitment for "${commitment.dealId.name}" by ${commitment.userId.name} changed from ${oldStatus} to ${status}${
      commitment.modifiedByDistributor ? 
      ` with modifications - Original: ${originalSizeDetails}, Modified: ${modifiedSizeDetails}, Total: $${commitment.modifiedTotalPrice}` : 
      ` - Details: ${originalSizeDetails}${discountTierMessage}, Total: $${commitment.totalPrice}`
    }`;

    await Log.create({
      message: logMessage,
      type: 'info',
      user_id: commitment.userId._id
    });

    // Notify member about status change
    await createNotification({
      recipientId: commitment.userId._id,
      senderId: commitment.dealId.distributor,
      type: 'commitment',
      subType: 'commitment_status_changed',
      title: 'Commitment Status Updated',
      message: `Your commitment for "${commitment.dealId.name}" has been ${status}${
        distributorResponse ? ` - Message: ${distributorResponse}` : ''
      }${
        modifiedSizeDetails ? ` - Modified sizes: ${modifiedSizeDetails}` : ''
      }`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'high'
    });

    // Notify admin about status change
    await notifyUsersByRole('admin', {
      type: 'commitment',
      subType: 'commitment_status_changed',
      title: 'Commitment Status Changed',
      message: `Commitment for deal "${commitment.dealId.name}" by ${commitment.userId.name} has been ${status} by distributor`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'medium'
    });

    // Send notifications
    if (commitment.userId.email) {
      let emailSubject = `Commitment Status Update - ${status.toUpperCase()}`;
      let emailMessage = `Your commitment for deal "${commitment.dealId.name}" has been ${status}`;
      
      if (commitment.modifiedByDistributor) {
        emailMessage += `\n\nOriginal Commitment:\n${originalSizeDetails}\nTotal: $${commitment.totalPrice.toFixed(2)}`;
        emailMessage += `\n\nModified Details:\n${modifiedSizeDetails}\nTotal: $${commitment.modifiedTotalPrice.toFixed(2)}`;
      } else {
        emailMessage += `\n\nDetails:\n${originalSizeDetails}${discountTierMessage}\nTotal: $${commitment.totalPrice.toFixed(2)}`;
      }

      if (distributorResponse) {
        emailMessage += `\n\nDistributor Message: ${distributorResponse}`;
      }

      await sendEmail(commitment.userId.email, emailSubject, emailMessage);
    }

    // Send SMS notifications
    if (commitment.userId.phone) {
      try {
        const commitmentInfo = {
          dealName: commitment.dealId.name,
          status: status,
          details: commitment.modifiedByDistributor ? 
            `Modified: ${modifiedSizeDetails}, Total: $${commitment.modifiedTotalPrice.toFixed(2)}` : 
            `${originalSizeDetails}${discountTierMessage}, Total: $${commitment.totalPrice.toFixed(2)}`,
          message: distributorResponse
        };
        await sendDealMessage.commitmentUpdate(commitment.userId.phone, commitmentInfo);
      } catch (error) {
        console.error('Failed to send commitment update SMS:', error);
      }
    }

    res.json({
      message: "Commitment status updated successfully",
      commitment
    });

  } catch (error) {
    console.error("Error updating commitment status:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while updating commitment status"
    });
  }
});

// Get user's commitments
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const commitments = await Commitment.find({ userId })
      .populate({
        path: 'dealId',
        select: 'name description category sizes totalSold totalRevenue views impressions discountTiers'
      });
    res.json(commitments);
  } catch (error) {
    console.error("Error fetching commitments:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching your commitments" 
    });
  }
});

// Add this new route to fetch commitments by userId
router.get("/fetch/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find all commitments for the user and populate the dealId field
    const commitments = await Commitment.find({ userId })
      .populate({
        path: 'dealId',
        select: 'name description category sizes totalSold totalRevenue views impressions discountTiers'
      })
      .populate({
        path: 'userId',
        select: 'name email phone'
      })
      .sort({ createdAt: -1 });
    
    if (!commitments) {
      return res.status(404).json({
        error: "Not found",
        message: "No commitments found for this user"
      });
    }

    res.json(commitments);
  } catch (error) {
    console.error("Error fetching commitments:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching commitments"
    });
  }
});

// Add this new route to fetch commitments for distributor's deals
router.get("/distributor-commitments/:distributorId", async (req, res) => {
  try {
    const { distributorId } = req.params;
    
    // First find all deals by this distributor
    const distributorDeals = await Deal.find({ distributor: distributorId });
    const dealIds = distributorDeals.map(deal => deal._id);
    
    // Find all commitments for these deals and populate necessary fields
    const commitments = await Commitment.find({ 
      dealId: { $in: dealIds } 
    })
    .populate({
      path: 'dealId',
      select: 'name description category sizes totalSold totalRevenue views impressions discountTiers'
    })
    .populate({
      path: 'userId',
      select: 'name email phone'
    })
    .sort({ createdAt: -1 });

    res.json(commitments);
  } catch (error) {
    console.error("Error fetching distributor commitments:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching distributor commitments"
    });
  }
});

// Add this new route to get detailed commitment information
router.get("/details/:commitmentId", async (req, res) => {
    try {
        const { commitmentId } = req.params;
        const { populate } = req.query;
        
        let query = Commitment.findById(commitmentId);

        // If populate is true, include all related data
        if (populate) {
            query = query
                .populate('userId', 'name email phone role')
                .populate({
                    path: 'dealId',
                    select: 'name description category sizes distributor discountTiers',
                    populate: {
                        path: 'distributor',
                        select: 'name email role _id'
                    }
                });
        } else {
            query = query
                .populate('userId', 'name email')
                .populate('dealId', 'name');
        }

        const commitment = await query;

        if (!commitment) {
            return res.status(404).json({
                error: "Not found",
                message: "Commitment not found"
            });
        }

        res.json(commitment);
    } catch (error) {
        console.error("Error fetching commitment details:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "An error occurred while fetching commitment details"
        });
    }
});

// Add this new route to fetch all commitments for admin
router.get("/admin/all-commitments", async (req, res) => {
  try {
    // Find all commitments and populate necessary fields
    const commitments = await Commitment.find({})
      .populate({
        path: 'dealId',
        select: 'name description category distributor sizes discountTiers totalSold totalRevenue views impressions',
        populate: {
          path: 'distributor',
          select: 'name email phone'
        }
      })
      .populate({
        path: 'userId',
        select: 'name email phone role'
      })
      .sort({ createdAt: -1 });

    res.json(commitments);
  } catch (error) {
    console.error("Error fetching all commitments:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching all commitments"
    });
  }
});

// Update the admin statistics route
router.get("/admin/statistics", async (req, res) => {
  try {
    // Get overall statistics
    const commitments = await Commitment.find({}).populate('dealId');
    
    // Calculate totals manually to handle the new sizeCommitments structure
    let totalCommitments = commitments.length;
    let totalAmount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let declinedCount = 0;
    let totalDistributors = new Set();
    let totalMembers = new Set();
    let totalQuantity = 0;
    
    commitments.forEach(commitment => {
      // Add up financial data
      totalAmount += commitment.totalPrice || 0;
      
      // Count by status
      if (commitment.status === 'pending') pendingCount++;
      if (commitment.status === 'approved') approvedCount++;
      if (commitment.status === 'declined') declinedCount++;
      
      // Track unique users
      if (commitment.userId) totalMembers.add(commitment.userId.toString());
      if (commitment.dealId && commitment.dealId.distributor) {
        totalDistributors.add(commitment.dealId.distributor.toString());
      }
      
      // Calculate total quantity across all size commitments
      if (commitment.sizeCommitments && Array.isArray(commitment.sizeCommitments)) {
        commitment.sizeCommitments.forEach(sc => {
          totalQuantity += sc.quantity || 0;
        });
      }
    });
    
    // Calculate average transaction value
    const avgTransactionValue = totalCommitments > 0 ? totalAmount / totalCommitments : 0;

    // Get timeline data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Group commitments by date and status
    const timelineMap = {};
    commitments.forEach(commitment => {
      if (commitment.createdAt >= thirtyDaysAgo) {
        const dateKey = commitment.createdAt.toISOString().slice(0, 10);
        
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = {
            pending: 0, pendingAmount: 0,
            approved: 0, approvedAmount: 0,
            declined: 0, declinedAmount: 0,
            cancelled: 0, cancelledAmount: 0,
            total: 0, totalAmount: 0,
            uniqueMembers: new Set(),
            uniqueDistributors: new Set()
          };
        }
        
        // Increment counts by status
        timelineMap[dateKey][commitment.status]++;
        timelineMap[dateKey][`${commitment.status}Amount`] += commitment.totalPrice || 0;
        timelineMap[dateKey].total++;
        timelineMap[dateKey].totalAmount += commitment.totalPrice || 0;
        
        // Track unique users for this day
        if (commitment.userId) {
          timelineMap[dateKey].uniqueMembers.add(commitment.userId.toString());
        }
        if (commitment.dealId && commitment.dealId.distributor) {
          timelineMap[dateKey].uniqueDistributors.add(commitment.dealId.distributor.toString());
        }
      }
    });
    
    // Format timeline data
    const formattedTimelineData = Object.keys(timelineMap).sort().map(date => {
      const dayData = timelineMap[date];
      return {
        date,
        pending: dayData.pending,
        approved: dayData.approved,
        declined: dayData.declined,
        cancelled: dayData.cancelled,
        pendingAmount: dayData.pendingAmount,
        approvedAmount: dayData.approvedAmount,
        declinedAmount: dayData.declinedAmount,
        cancelledAmount: dayData.cancelledAmount,
        total: dayData.total,
        totalAmount: dayData.totalAmount,
        uniqueMembers: dayData.uniqueMembers.size,
        uniqueDistributors: dayData.uniqueDistributors.size
      };
    });

    // Calculate growth rates
    const calculateGrowthRate = (current, previous) => {
      return previous ? ((current - previous) / previous) * 100 : 0;
    };

    const growth = {
      commitments: calculateGrowthRate(
        formattedTimelineData[formattedTimelineData.length - 1]?.total || 0,
        formattedTimelineData[0]?.total || 0
      ),
      revenue: calculateGrowthRate(
        formattedTimelineData[formattedTimelineData.length - 1]?.totalAmount || 0,
        formattedTimelineData[0]?.totalAmount || 0
      )
    };

    // Get top distributors
    const distributorStats = {};
    commitments.forEach(commitment => {
      if (commitment.dealId && commitment.dealId.distributor) {
        const distributorId = commitment.dealId.distributor.toString();
        
        if (!distributorStats[distributorId]) {
          distributorStats[distributorId] = {
            _id: distributorId,
            totalCommitments: 0,
            totalAmount: 0,
            approvedCount: 0,
            distributor: commitment.dealId.distributor,
            name: commitment.dealId.distributor.name || 'Unknown',
            email: commitment.dealId.distributor.email || '',
          };
        }
        
        distributorStats[distributorId].totalCommitments++;
        distributorStats[distributorId].totalAmount += commitment.totalPrice || 0;
        
        if (commitment.status === 'approved') {
          distributorStats[distributorId].approvedCount++;
        }
      }
    });
    
    // Calculate success rate and format top distributors
    const topDistributors = Object.values(distributorStats)
      .map(dist => ({
        ...dist,
        successRate: dist.totalCommitments > 0 ? (dist.approvedCount / dist.totalCommitments) : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    res.json({
      totalCommitments,
      totalAmount,
      totalQuantity,
      pendingCount,
      approvedCount,
      declinedCount,
      timelineData: formattedTimelineData,
      topDistributors,
      growth,
      totalDistributors: totalDistributors.size,
      totalMembers: totalMembers.size,
      avgTransactionValue
    });
  } catch (error) {
    console.error("Error fetching commitment statistics:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while fetching commitment statistics"
    });
  }
});

router.get("/user-stats", async (req, res) => {
  try {
    const membersCount = await User.countDocuments({ role: "member" });
    const distributorsCount = await User.countDocuments({ role: "distributor" });

    res.json({
      members: membersCount,
      distributors: distributorsCount
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
