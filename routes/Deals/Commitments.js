const express = require("express");
const Commitment = require("../../models/Commitments");
const Deal = require("../../models/Deals");
const User = require('../../models/User');
const { sendDealMessage } = require('../../utils/message');
const { createNotification, notifyUsersByRole } = require('../Common/Notification');
const DailyCommitmentSummary = require('../../models/DailyCommitmentSummary');
const { isAuthenticated, isMemberAdmin, getCurrentUserContext, isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const router = express.Router();

// Create a new commitment or update existing one (Get Deal)
router.post("/buy/:dealId", isMemberAdmin, async (req, res) => {
  try {
    const { dealId } = req.params;
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { sizeCommitments } = req.body;

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

    // Check if commitment period has ended
    if (deal.commitmentEndsAt) {
      const commitmentEndDate = new Date(deal.commitmentEndsAt);
      const now = new Date();
      if (now > commitmentEndDate) {
        return res.status(400).json({
          error: "Commitment period ended",
          message: `The commitment period for this deal ended on ${commitmentEndDate.toLocaleDateString()}. You can no longer make commitments to this deal.`
        });
      }
    }

    // Check if commitment period has started (optional validation)
    if (deal.commitmentStartAt) {
      const commitmentStartDate = new Date(deal.commitmentStartAt);
      const now = new Date();
      if (now < commitmentStartDate) {
        return res.status(400).json({
          error: "Commitment period not started",
          message: `The commitment period for this deal starts on ${commitmentStartDate.toLocaleDateString()}. You can make commitments during the active period.`
        });
      }
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

    // Get existing commitments for this deal to calculate size-specific totals
      const existingCommitments = await Commitment.find({
        dealId: dealId,
        status: { $ne: "cancelled" }
      });
      
    // Calculate total quantities per size across all commitments
    const sizeTotals = {};
    
    // First, tally up quantities from existing commitments
    existingCommitments.forEach(commitment => {
        if (commitment.sizeCommitments && Array.isArray(commitment.sizeCommitments)) {
        commitment.sizeCommitments.forEach(sc => {
          if (!sizeTotals[sc.size]) {
            sizeTotals[sc.size] = 0;
          }
          sizeTotals[sc.size] += sc.quantity;
        });
      }
    });
      
    // Add the new commitment quantities
    sizeCommitments.forEach(sc => {
      if (!sizeTotals[sc.size]) {
        sizeTotals[sc.size] = 0;
      }
      sizeTotals[sc.size] += sc.quantity;
    });

    // Process each size commitment with potential tier discounts
    let totalPrice = 0;
    const processedSizeCommitments = [];
    
    for (const sizeCommit of sizeCommitments) {
      const matchingSize = deal.sizes.find(s => s.size === sizeCommit.size);
      const quantityForSize = Number(sizeCommit.quantity);
      let pricePerUnit = Number(matchingSize.discountPrice);
      let appliedDiscountTier = null;
      
      // Check for size-specific discount tiers
      if (matchingSize.discountTiers && matchingSize.discountTiers.length > 0) {
        // Get total quantity for this specific size ACROSS ALL COMMITMENTS
        // This implements the collective volume discount approach
        const sizeTotal = sizeTotals[sizeCommit.size] || 0;
      
      // Sort tiers by quantity in descending order to find the highest applicable tier
        const sortedTiers = [...matchingSize.discountTiers].sort((a, b) => b.tierQuantity - a.tierQuantity);
      
        // Find highest applicable tier for this size
      for (const tier of sortedTiers) {
          if (sizeTotal >= tier.tierQuantity) {
            // Apply tier discount based on collective total, not just this order
            pricePerUnit = tier.tierDiscount;
          appliedDiscountTier = tier;
          break;
        }
      }
      }
      
      const totalPriceForSize = quantityForSize * pricePerUnit;
      
      processedSizeCommitments.push({
        size: sizeCommit.size,
        quantity: quantityForSize,
        pricePerUnit: pricePerUnit,
        originalPricePerUnit: Number(matchingSize.discountPrice),
        totalPrice: totalPriceForSize,
        appliedDiscountTier: appliedDiscountTier ? {
          tierQuantity: appliedDiscountTier.tierQuantity,
          tierDiscount: appliedDiscountTier.tierDiscount
        } : null
      });
      
      totalPrice += totalPriceForSize;
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
      await commitment.save();
    } else {
      isNewCommitment = true;
      commitment = await Commitment.create({
        userId: userId,
        dealId: dealId,
        sizeCommitments: processedSizeCommitments,
        totalPrice,
        status: "pending"
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
      quantity: processedSizeCommitments.reduce((total, sc) => total + sc.quantity, 0),
      totalPrice: totalPrice,
      dealName: deal.name
    });

    // Recalculate summary totals
    summary.totalQuantity = summary.commitments.reduce((sum, c) => sum + c.quantity, 0);
    summary.totalAmount = summary.commitments.reduce((sum, c) => sum + c.totalPrice, 0);
    summary.totalCommitments = summary.commitments.length;
    
    await summary.save();

    // IMPLEMENT COLLECTIVE VOLUME DISCOUNTS:
    // After a new commitment is saved or updated, check if any discount tiers were affected
    // and update ALL commitments for the deal to apply the correct discount tier

    // Check if any discount tiers were activated or deactivated
    const sizesWithDiscountTiers = deal.sizes.filter(size => 
      size.discountTiers && size.discountTiers.length > 0
    );

    // Only proceed if this deal has sizes with discount tiers
    if (sizesWithDiscountTiers.length > 0) {
      // Get all active commitments for this deal (excluding cancelled ones)
      const allCommitments = await Commitment.find({
        dealId: dealId,
        status: { $ne: "cancelled" }
      });
      
      // Track which sizes need updates due to tier changes (activated or deactivated)
      const sizesNeedingUpdate = [];
      
      // For each size with discount tiers, check if any tiers were activated or deactivated
      for (const size of sizesWithDiscountTiers) {
        // Calculate total quantity for this size across all commitments
        const totalQuantityForSize = allCommitments.reduce((total, c) => {
          const sizeCommit = c.sizeCommitments.find(sc => sc.size === size.size);
          return total + (sizeCommit ? sizeCommit.quantity : 0);
        }, 0);
        
        // Sort tiers by quantity in descending order to find the highest applicable tier
        const sortedTiers = [...size.discountTiers].sort((a, b) => b.tierQuantity - a.tierQuantity);
        
        // Find highest applicable tier for this size
        let highestApplicableTier = null;
        for (const tier of sortedTiers) {
          if (totalQuantityForSize >= tier.tierQuantity) {
            highestApplicableTier = tier;
            break;
          }
        }
        
        // Add to sizes needing update with the appropriate tier (or null if no tier applies anymore)
        sizesNeedingUpdate.push({
          size: size.size,
          tier: highestApplicableTier,
          originalPrice: size.discountPrice,
          totalQuantity: totalQuantityForSize
        });
      }
      
      // If any sizes need updating due to tier changes
      if (sizesNeedingUpdate.length > 0) {
        // Update all commitments with the correct tier pricing
        for (const commitmentToUpdate of allCommitments) {
          let commitmentUpdated = false;
          let updatedTotalPrice = 0;
          
          // Update each size commitment with the correct tier pricing
          for (const sizeCommit of commitmentToUpdate.sizeCommitments) {
            // Find this size in the update list
            const sizeUpdate = sizesNeedingUpdate.find(su => su.size === sizeCommit.size);
            
            if (sizeUpdate) {
              // If a tier applies, use its discount price
              if (sizeUpdate.tier) {
                // Only mark as updated if the price is changing
                if (sizeCommit.pricePerUnit !== sizeUpdate.tier.tierDiscount) {
                  sizeCommit.pricePerUnit = sizeUpdate.tier.tierDiscount;
                  sizeCommit.appliedDiscountTier = {
                    tierQuantity: sizeUpdate.tier.tierQuantity,
                    tierDiscount: sizeUpdate.tier.tierDiscount
                  };
                  commitmentUpdated = true;
                }
              } else {
                // No tier applies anymore, revert to original price
                // Only mark as updated if the price is changing
                if (sizeCommit.pricePerUnit !== sizeUpdate.originalPrice) {
                  sizeCommit.pricePerUnit = sizeUpdate.originalPrice;
                  sizeCommit.appliedDiscountTier = null;
                  commitmentUpdated = true;
                }
              }
              
              // Recalculate total price for this size
              sizeCommit.totalPrice = sizeCommit.quantity * sizeCommit.pricePerUnit;
            }
            
            updatedTotalPrice += sizeCommit.totalPrice;
          }
          
          // Save the updated commitment if changes were made
          if (commitmentUpdated) {
            commitmentToUpdate.totalPrice = updatedTotalPrice;
            await commitmentToUpdate.save();
            
            // Only notify if this isn't the commitment we just created/updated
            if (commitmentToUpdate._id.toString() !== commitment._id.toString()) {
              // Notify user of the tier change (activation or deactivation)
              const activatedTiers = sizesNeedingUpdate.filter(su => su.tier !== null);
              const deactivatedTiers = sizesNeedingUpdate.filter(su => su.tier === null && su.totalQuantity > 0);
              
              let notificationTitle = "";
              let notificationMessage = "";
              
              if (activatedTiers.length > 0 && deactivatedTiers.length > 0) {
                notificationTitle = 'Volume Discount Tiers Updated';
                notificationMessage = `Deal "${deal.name}" has had discount tier changes. Some sizes reached new tiers, others dropped below tier thresholds.`;
              } else if (activatedTiers.length > 0) {
                notificationTitle = 'Volume Discount Tier Reached';
                notificationMessage = `A volume discount tier has been reached for deal "${deal.name}" - Your commitment has been automatically updated with better pricing!`;
              } else if (deactivatedTiers.length > 0) {
                notificationTitle = 'Volume Discount Tier Lost';
                notificationMessage = `The collective quantity for deal "${deal.name}" has dropped below a discount tier threshold - Your price has been adjusted accordingly.`;
              }
              
              await createNotification({
                recipientId: commitmentToUpdate.userId,
                senderId: null,
                type: 'discount',
                subType: 'tier_changed',
                title: notificationTitle,
                message: notificationMessage,
                relatedId: commitmentToUpdate._id,
                onModel: 'Commitment',
                priority: 'medium'
              });
            }
          }
        }
        
        // Notify the distributor about tier changes
        const activatedTiers = sizesNeedingUpdate.filter(su => su.tier !== null);
        const deactivatedTiers = sizesNeedingUpdate.filter(su => su.tier === null && su.totalQuantity > 0);
        
        if (activatedTiers.length > 0 || deactivatedTiers.length > 0) {
          let notificationTitle = '';
          let notificationMessage = '';
          
          if (activatedTiers.length > 0 && deactivatedTiers.length > 0) {
            notificationTitle = 'Volume Discount Tiers Changed';
            
            const activatedDetails = activatedTiers.map(su => 
              `${su.size} reached ${su.tier.tierQuantity}+ units (price: $${su.tier.tierDiscount})`
            ).join(', ');
            
            const deactivatedDetails = deactivatedTiers.map(su => 
              `${su.size} dropped below tier threshold (now: ${su.totalQuantity} units)`
            ).join(', ');
            
            notificationMessage = `Your deal "${deal.name}" has tier changes. Activated: ${activatedDetails}. Deactivated: ${deactivatedDetails}`;
          } else if (activatedTiers.length > 0) {
            notificationTitle = 'Volume Discount Tier Reached';
            
            const sizesDetails = activatedTiers.map(su => 
              `${su.size} reached ${su.tier.tierQuantity}+ units (price: $${su.tier.tierDiscount})`
            ).join(', ');
            
            notificationMessage = `Your deal "${deal.name}" has reached volume discount tiers for: ${sizesDetails}`;
          } else if (deactivatedTiers.length > 0) {
            notificationTitle = 'Volume Discount Tier Lost';
            
            const sizesDetails = deactivatedTiers.map(su => 
              `${su.size} dropped below tier threshold (now: ${su.totalQuantity} units)`
            ).join(', ');
            
            notificationMessage = `Your deal "${deal.name}" has lost volume discount tiers for: ${sizesDetails}`;
          }
          
          await createNotification({
            recipientId: deal.distributor,
            senderId: null,
            type: 'discount',
            subType: 'tier_changed',
            title: notificationTitle,
            message: notificationMessage,
            relatedId: deal._id,
            onModel: 'Deal',
            priority: 'medium'
          });
        }
      }
    }

    // Generate size details message for notifications
    const sizeDetailsMessage = processedSizeCommitments.map(sc => {
      const tierInfo = sc.appliedDiscountTier 
        ? ` (with tier discount at ${sc.appliedDiscountTier.tierQuantity}+ units)` 
        : '';
      
      return `${sc.size}: ${sc.quantity} units at $${sc.pricePerUnit.toFixed(2)} each${tierInfo}`;
    }).join(', ');


    await createNotification({
      recipientId: deal.distributor,
      senderId: userId,
      type: 'commitment',
      subType: 'commitment_created',
      title: 'New Deal Commitment',
      message: `${user.name} has committed to your deal "${deal.name}" - Total: ${processedSizeCommitments.reduce((total, sc) => total + sc.quantity, 0)} units, $${totalPrice.toFixed(2)}. Size details: ${sizeDetailsMessage}`,
      relatedId: commitment._id,
      onModel: 'Commitment',
      priority: 'high'
    });


    // Log the action
    await logCollaboratorAction(req, 'create_commitment', 'commitment', {
      dealTitle: deal.name,
      dealId: dealId,
      commitmentId: commitment._id,
      additionalInfo: `Committed to ${processedSizeCommitments.reduce((total, sc) => total + sc.quantity, 0)} units`
    });

    res.json({
      message: "Successfully committed to the deal",
      commitment,
      updatedDeal: deal,
    });
  } catch (error) {
    console.error("Error committing to deal:", error);
    await logError(req, 'create_commitment', 'commitment', error, {
      dealId: req.params.dealId,
      sizeCommitments: req.body.sizeCommitments?.length || 0
    });
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

    // Log the action
    await logCollaboratorAction(req, 'update_commitment_status', 'commitment', {
      dealTitle: commitment.dealId.name,
      dealId: commitment.dealId._id,
      commitmentId: commitmentId,
      status: status,
      additionalInfo: `Updated commitment status to ${status}`
    });

    res.json({
      message: "Commitment status updated successfully",
      commitment
    });

  } catch (error) {
    console.error("Error updating commitment status:", error);
    await logError(req, 'update_commitment_status', 'commitment', error, {
      commitmentId: req.body.commitmentId,
      status: req.body.status
    });
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while updating commitment status"
    });
  }
});

// Get user's commitments
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const commitments = await Commitment.find({ userId })
      .populate({
        path: 'dealId',
        select: 'name description category sizes totalSold totalRevenue views impressions discountTiers'
      });
    
    // Log the action
    await logCollaboratorAction(req, 'view_user_commitments', 'user commitments', {
      additionalInfo: `Found ${commitments.length} commitments`
    });
    
    res.json(commitments);
  } catch (error) {
    console.error("Error fetching commitments:", error);
    await logError(req, 'view_user_commitments', 'user commitments', error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching your commitments" 
    });
  }
});

// Add this new route to fetch commitments by userId
router.get("/fetch/:userId", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const { userId } = req.params;
    
    // Users can only fetch their own commitments, or admins can fetch any user's commitments
    if (currentUser.id !== userId && currentUser.role !== 'admin') {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only view your own commitments"
      });
    }
    
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
    await logError(req, 'view_user_commitments', 'commitments', error, {
      userId: req.params.userId
    });
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
    await logError(req, 'view_distributor_commitments', 'commitments', error, {
      distributorId: req.params.distributorId
    });
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
        await logError(req, 'view_commitment_details', 'commitment details', error, {
            commitmentId: req.params.commitmentId
        });
        res.status(500).json({
            error: "Internal Server Error",
            message: "An error occurred while fetching commitment details"
        });
    }
});

// Add this new route to fetch all commitments for admin (admin only)
router.get("/admin/all-commitments", isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

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
    await logError(req, 'view_all_commitments', 'commitments', error);
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "An error occurred while fetching all commitments"
    });
  }
});

// Update the admin statistics route (admin only)
router.get("/admin/statistics", isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

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
    await logError(req, 'view_commitment_statistics', 'commitment statistics', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while fetching commitment statistics"
    });
  }
});

router.get("/user-stats", isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

    const membersCount = await User.countDocuments({ role: "member" });
    const distributorsCount = await User.countDocuments({ role: "distributor" });

    res.json({
      members: membersCount,
      distributors: distributorsCount
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    await logError(req, 'view_user_stats', 'user statistics', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
