const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const Log = require('../../models/Logs');

router.get('/:distributorId', async (req, res) => {
  try {
    const { distributorId } = req.params;
    const { minPrice, maxPrice, minQuantity, status, distributor, sortBy, sortOrder, month } = req.query;

    // Initialize filter with distributorId
    const filter = { distributor: distributorId };

    // Month filter - default to current month if no month specified
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-based index
    const monthToFilter = month ? parseInt(month) - 1 : currentMonth;
    const startOfMonth = new Date(currentYear, monthToFilter, 1);
    const endOfMonth = new Date(currentYear, monthToFilter + 1, 0, 23, 59, 59);
    filter.createdAt = { $gte: startOfMonth, $lte: endOfMonth };

    // Price filters using discountPrice
    if (minPrice) filter.discountPrice = { $gte: Number(minPrice) };
    if (maxPrice) filter.discountPrice = { ...filter.discountPrice, $lte: Number(maxPrice) };

    // Minimum quantity filter
    if (minQuantity) filter.minQtyForDiscount = { $gte: Number(minQuantity) };

    // Status filter
    if (status) filter.status = status;

    // Distributor filter
    if (distributor) filter.distributor = distributor;
    
    // Sorting options
    const sortOptions = {
      price: 'discountPrice',
      originalPrice: 'originalCost',
      quantity: 'minQtyForDiscount',
      savings: { $subtract: ['$originalCost', '$discountPrice'] },
      views: 'views',
      impressions: 'impressions',
      totalSold: 'totalSold',
      revenue: 'totalRevenue',
      date: 'createdAt'
    };

    const sortField = sortOptions[sortBy] || 'createdAt';
    const sort = {};
    sort[typeof sortField === 'string' ? sortField : '_id'] = sortOrder === 'desc' ? -1 : 1;

    // Fetch deals with populated distributor info (No limit applied)
    let deals = await Deal.find(filter)
      .sort(sort)
      .populate('distributor', 'name email businessName contactPerson phone logo')
      .populate('commitments', 'quantity');

    // Add calculated fields to each deal
    deals = deals.map(deal => {
      const savingsPerUnit = deal.originalCost - deal.discountPrice;
      const savingsPercentage = ((savingsPerUnit / deal.originalCost) * 100).toFixed(2);
      return {
        ...deal.toObject(),
        savingsPerUnit,
        savingsPercentage,
        totalPotentialSavings: savingsPerUnit * deal.minQtyForDiscount,
        totalCommitmentQuantity: deal.commitments.reduce((total, commitment) => total + commitment.quantity, 0)
      };
    });

    // Get total count for logging purposes
    const totalDeals = await Deal.countDocuments(filter);
    res.json({
      deals,
      totalDeals
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    await Log.create({
      message: `Error fetching deals: ${error.message}`,
      type: 'error',
      user_id: req.user?.id
    });
    res.status(500).json({ message: 'Error fetching deals' });
  }
});

module.exports = router;
