const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

router.get('/', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    
    const { 
      category, 
      status, 
      minPrice, 
      maxPrice, 
      search, 
      sortBy, 
      month 
    } = req.query;
    
    // Set up query filter
    const filter = { distributor: distributorId };
    
    // Add category filter if provided
    if (category) {
      filter.category = category;
    }
    
    // Add status filter if provided
    if (status) {
      filter.status = status;
    }
    
    // Handle month filtering
    let currentMonth = null;
    if (month && month !== '') {
      // If month is provided, filter by that specific month
      const now = new Date();
      const filterMonth = parseInt(month) - 1; // Months are 0-indexed in JS
      const filterYear = now.getFullYear();
      
      // Create start and end date for the selected month
      const startDate = new Date(filterYear, filterMonth, 1);
      const endDate = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999);
      
      // Filter deals that are active during the selected month (overlap with the month)
      filter.$or = [
        { 
          dealStartAt: { $lte: endDate },
          dealEndsAt: { $gte: startDate }
        },
        // Include deals without specific dates
        { dealStartAt: { $exists: false } },
        { dealEndsAt: { $exists: false } }
      ];
      
      // Set currentMonth for response
      currentMonth = filterMonth + 1; // Convert back to 1-indexed for frontend
    }
    // If no month is provided (All Months selected), don't add any date filtering
    
    // Add search filter if provided
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    
    // Handle price filtering
    if (minPrice || maxPrice) {
      // For deals with sizes array
      const sizesPriceFilter = {};
      
      if (minPrice) {
        sizesPriceFilter['sizes.discountPrice'] = { $gte: parseFloat(minPrice) };
      }
      
      if (maxPrice) {
        if (sizesPriceFilter['sizes.discountPrice']) {
          sizesPriceFilter['sizes.discountPrice'].$lte = parseFloat(maxPrice);
        } else {
          sizesPriceFilter['sizes.discountPrice'] = { $lte: parseFloat(maxPrice) };
        }
      }
      
      // For deals without sizes array (using direct discountPrice)
      const directPriceFilter = {};
      
      if (minPrice) {
        directPriceFilter.discountPrice = { $gte: parseFloat(minPrice) };
      }
      
      if (maxPrice) {
        if (directPriceFilter.discountPrice) {
          directPriceFilter.discountPrice.$lte = parseFloat(maxPrice);
        } else {
          directPriceFilter.discountPrice = { $lte: parseFloat(maxPrice) };
        }
      }
      
      // Combine both filtering options with $or
      if (Object.keys(sizesPriceFilter).length > 0 || Object.keys(directPriceFilter).length > 0) {
        filter.$and = [
          { $or: [sizesPriceFilter, directPriceFilter] }
        ];
      }
    }
    
    // Prepare sorting options
    let sortOptions = { createdAt: -1 }; // Default sort by newest
    
    if (sortBy === 'priceAsc') {
      // Sort by minimum price across all sizes
      sortOptions = { avgDiscountPrice: 1 };
    } else if (sortBy === 'priceDesc') {
      sortOptions = { avgDiscountPrice: -1 };
    } else if (sortBy === 'nameAsc') {
      sortOptions = { name: 1 };
    } else if (sortBy === 'nameDesc') {
      sortOptions = { name: -1 };
    }
    
    // Fetch deals with populated commitment info
    console.log(`Fetching deals with filter:`, JSON.stringify(filter, null, 2));
    
    // First get the deals without populating to check commitments array
    let deals = await Deal.find(filter).sort(sortOptions).lean();
    
    // Add a fallback empty array for any deals that have undefined commitments
    deals = deals.map(deal => {
      if (!deal.commitments) {
        console.log(`Deal ${deal.name} has undefined commitments array, adding empty array`);
        return { ...deal, commitments: [] };
      }
      return deal;
    });

    // Now populate the commitments for all deals
    deals = await Deal.populate(deals, {
      path: 'commitments',
      model: 'Commitment',
      select: 'userId sizeCommitments totalPrice status modifiedByDistributor modifiedSizeCommitments modifiedTotalPrice paymentStatus appliedDiscountTier',
      populate: {
        path: 'userId',
        model: 'User',
        select: 'name email businessName'
      }
    });
    
    console.log(`Found ${deals.length} deals, checking commitments...`);
    
    // Calculate total quantity committed and other derived fields
    const processedDeals = deals.map(deal => {
      // Log commitment info for debugging
      console.log(`Deal "${deal.name}" has ${deal.commitments ? deal.commitments.length : 0} commitments`);
      
      // Calculate total quantities for all commitment statuses
      let totalCommittedQuantity = 0;
      let pendingCommitmentCount = 0;
      let approvedCommitmentCount = 0;
      let totalCommitmentCount = deal.commitments ? deal.commitments.length : 0;
      
      if (deal.commitments && deal.commitments.length > 0) {
        // Get counts by status
        approvedCommitmentCount = deal.commitments.filter(c => c.status === 'approved').length;
        pendingCommitmentCount = deal.commitments.filter(c => c.status === 'pending').length;
        
        console.log(`Deal "${deal.name}" has ${approvedCommitmentCount} approved and ${pendingCommitmentCount} pending commitments`);
        
        // Include ALL commitments in the calculation, not just approved ones
        deal.commitments.forEach(commitment => {
          if (commitment.sizeCommitments && commitment.sizeCommitments.length > 0) {
            commitment.sizeCommitments.forEach(sizeCommit => {
              totalCommittedQuantity += sizeCommit.quantity;
            });
          }
        });
      }
      
      // Calculate average prices if deal has sizes
      let avgOriginalCost = null;
      let avgDiscountPrice = null;
      
      if (deal.sizes && deal.sizes.length > 0) {
        const totalOriginal = deal.sizes.reduce((sum, size) => sum + size.originalCost, 0);
        const totalDiscount = deal.sizes.reduce((sum, size) => sum + size.discountPrice, 0);
        
        avgOriginalCost = totalOriginal / deal.sizes.length;
        avgDiscountPrice = totalDiscount / deal.sizes.length;
      }
      
      return {
        ...deal,
        totalCommittedQuantity,
        approvedCommitmentCount,
        pendingCommitmentCount,
        totalCommitmentCount,
        avgOriginalCost,
        avgDiscountPrice
      };
    });
    
    // Get all categories for the distributor for filters
    const categories = await Deal.distinct('category', { distributor: distributorId });
    
    // Return counts and filtered deals
    await logCollaboratorAction(req, 'view_distributor_deals', 'deals', { 
      totalDeals: deals.length,
      categories: categories.length,
      currentMonth: currentMonth,
      additionalInfo: `Distributor viewed their deals with filters applied`
    });
    return res.status(200).json({
      totalDeals: deals.length,
      deals: processedDeals,
      categories,
      currentMonth: currentMonth // Will be null if "All Months" is selected
    });
    
  } catch (error) {
    console.error('Error fetching deals:', error);
    await logError(req, 'view_distributor_deals', 'deals', error, {
      category: req.query.category,
      status: req.query.status,
      month: req.query.month,
      search: req.query.search
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching deals', 
      error: error.message 
    });
  }
});

// Route to fetch just categories for a distributor
router.get('/categories/:distributorId', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    
    // Get all distinct categories for the distributor
    const categories = await Deal.distinct('category', { distributor: distributorId });
    
    await logCollaboratorAction(req, 'view_deal_categories', 'deals', { 
      categoriesCount: categories.length,
      additionalInfo: 'Distributor viewed their deal categories'
    });
    return res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    await logError(req, 'view_deal_categories', 'deals', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

module.exports = router;
