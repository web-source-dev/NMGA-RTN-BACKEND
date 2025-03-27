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
    const { userId, quantity } = req.body;

    if (!userId || !quantity) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "Please provide all required information" 
      });
    }

    const deal = await Deal.findById(dealId);
    const user = await User.findById(userId);

    if (!deal || !user) {
      return res.status(404).json({ 
        error: "Not found",
        message: "Deal or user not found" 
      });
    }

    const totalPrice = quantity * deal.discountPrice;
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
      commitment.quantity = quantity; // Fix: Set quantity instead of adding to existing quantity
      commitment.totalPrice = totalPrice;
      commitment.status = "pending";
      commitment.modifiedByDistributor = false;
      commitment.modifiedQuantity = null;
      commitment.modifiedTotalPrice = null;
      await commitment.save();
    } else {
      isNewCommitment = true;
      commitment = await Commitment.create({
        userId: userId,
        dealId: dealId,
        quantity,
        totalPrice,
        status: "pending",
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
    
    summary.commitments.push({
      commitmentId: commitment._id,
      dealId: dealId,
      quantity: quantity,
      totalPrice: totalPrice,
      dealName: deal.name,
      originalCost: deal.originalCost,
      discountPrice: deal.discountPrice
    });

    // Recalculate summary totals
    summary.totalQuantity = summary.commitments.reduce((sum, c) => sum + c.quantity, 0);
    summary.totalAmount = summary.commitments.reduce((sum, c) => sum + c.totalPrice, 0);
    summary.totalCommitments = summary.commitments.length;
    
    await summary.save();

    await createNotification({
      recipientId: deal.distributor,
      senderId: userId,
      type: 'commitment',
      subType: 'commitment_created',
      title: 'New Deal Commitment',
      message: `${user.name} has committed to your deal "${deal.name}" - Quantity: ${quantity}, Total: $${totalPrice}`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'high'
    });

    await notifyUsersByRole('admin', {
      type: 'commitment',
      subType: 'commitment_created',
      title: 'New Deal Commitment',
      message: `${user.name} has committed to deal "${deal.name}" by distributor ${distributor.name}`,
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
      modifiedQuantity,
      modifiedTotalPrice
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

    // If modifying quantity, validate against minimum quantity
    if (modifiedQuantity && modifiedQuantity < commitment.dealId.minQtyForDiscount) {
      return res.status(400).json({
        error: "Invalid quantity",
        message: `Modified quantity must be at least ${commitment.dealId.minQtyForDiscount}`
      });
    }

    // If modifying total price, validate calculation
    if (modifiedQuantity || modifiedTotalPrice) {
      const expectedTotal = (modifiedQuantity || commitment.quantity) * commitment.dealId.discountPrice;
      if (modifiedTotalPrice && Math.abs(modifiedTotalPrice - expectedTotal) > 0.01) {
        return res.status(400).json({
          error: "Invalid price",
          message: "Modified total price does not match expected calculation"
        });
      }
    }

    // Update commitment
    commitment.status = status;
    commitment.distributorResponse = distributorResponse || commitment.distributorResponse;

    if (modifiedQuantity) {
      commitment.modifiedQuantity = modifiedQuantity;
      commitment.modifiedByDistributor = true;
      commitment.modifiedTotalPrice = modifiedQuantity * commitment.dealId.discountPrice;
    }

    await commitment.save();

    // Update deal statistics if commitment is approved
    if (status === 'approved') {
      const deal = await Deal.findById(commitment.dealId);
      if (deal) {
        const finalQuantity = commitment.modifiedQuantity || commitment.quantity;
        const finalTotalPrice = commitment.modifiedTotalPrice || commitment.totalPrice;
        
        deal.totalSold = (deal.totalSold || 0) + finalQuantity;
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

    // Create detailed log entry
    const logMessage = `Commitment for "${commitment.dealId.name}" by ${commitment.userId.name} changed from ${oldStatus} to ${status}${
      commitment.modifiedByDistributor ? 
      ` with modifications - Quantity: ${commitment.modifiedQuantity}, Price: $${commitment.modifiedTotalPrice}` : 
      ''
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
        modifiedQuantity ? ` - Modified quantity: ${modifiedQuantity}` : ''
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
        const savings = (commitment.dealId.originalCost - commitment.dealId.discountPrice) * commitment.modifiedQuantity;
        emailMessage += `\n\nModified Details:
- Quantity: ${commitment.modifiedQuantity}
- Price per unit: $${commitment.dealId.discountPrice}
- Total Price: $${commitment.modifiedTotalPrice}
- Total Savings: $${savings}`;
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
          quantity: commitment.modifiedQuantity || commitment.quantity,
          totalPrice: commitment.modifiedTotalPrice || commitment.totalPrice,
          originalCost: commitment.dealId.originalCost,
          discountPrice: commitment.dealId.discountPrice,
          modifiedDetails: commitment.modifiedByDistributor ? {
            quantity: commitment.modifiedQuantity,
            price: commitment.modifiedTotalPrice,
            message: distributorResponse
          } : null
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
        select: 'name description category originalCost discountPrice totalSold totalRevenue views impressions'
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
        select: 'name description category originalCost discountPrice totalSold totalRevenue views impressions'
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
      select: 'name description category originalCost discountPrice totalSold totalRevenue views impressions'
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
                    select: 'name description category originalCost discountPrice distributor',
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
        select: 'name description category distributor originalCost discountPrice totalSold totalRevenue views impressions',
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
    const stats = await Commitment.aggregate([
      {
        $group: {
          _id: null,
          totalCommitments: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
          },
          declinedCount: {
            $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] }
          },
          // Add distributor and member stats
          totalDistributors: { $addToSet: "$dealId.distributor" },
          totalMembers: { $addToSet: "$userId" },
          // Add average transaction value
          avgTransactionValue: { $avg: "$totalPrice" }
        }
      }
    ]);

    // Get timeline data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Enhanced timeline data with more metrics
    const timelineData = await Commitment.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $lookup: {
          from: 'deals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status"
          },
          count: { $sum: 1 },
          amount: { $sum: "$totalPrice" },
          uniqueMembers: { $addToSet: "$userId" },
          uniqueDistributors: { $addToSet: { $arrayElemAt: ["$deal.distributor", 0] } }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count",
              amount: "$amount",
              uniqueMembers: { $size: "$uniqueMembers" },
              uniqueDistributors: { $size: "$uniqueDistributors" }
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format timeline data with enhanced metrics
    const formattedTimelineData = timelineData.map(day => {
      const dayData = {
        date: day._id,
        pending: 0,
        approved: 0,
        declined: 0,
        cancelled: 0,
        pendingAmount: 0,
        approvedAmount: 0,
        declinedAmount: 0,
        cancelledAmount: 0,
        total: 0,
        totalAmount: 0,
        uniqueMembers: 0,
        uniqueDistributors: 0
      };

      day.statuses.forEach(status => {
        dayData[status.status] = status.count;
        dayData[`${status.status}Amount`] = status.amount;
        dayData.total += status.count;
        dayData.totalAmount += status.amount;
        dayData.uniqueMembers = Math.max(dayData.uniqueMembers, status.uniqueMembers);
        dayData.uniqueDistributors = Math.max(dayData.uniqueDistributors, status.uniqueDistributors);
      });

      return dayData;
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
    const topDistributors = await Commitment.aggregate([
      {
        $lookup: {
          from: 'deals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal'
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ["$deal.distributor", 0] },
          totalCommitments: { $sum: 1 },
          totalAmount: { $sum: "$totalPrice" },
          successRate: {
            $avg: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'distributor'
        }
      },
      {
        $sort: { totalAmount: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json({
      ...stats[0],
      timelineData: formattedTimelineData,
      topDistributors,
      growth,
      totalDistributors: stats[0].totalDistributors?.length || 0,
      totalMembers: stats[0].totalMembers?.length || 0
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
