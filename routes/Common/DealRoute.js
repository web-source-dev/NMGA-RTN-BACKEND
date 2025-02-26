const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');

// Get all deals
router.get('/', async (req, res) => {
  try {
    const deals = await Deal.find().populate('distributor commitments');
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new deal
router.post('/', async (req, res) => {
  try {
    const newDeal = new Deal(req.body);
    const savedDeal = await newDeal.save();
    res.status(201).json(savedDeal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get recent deals endpoint
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const deals = await Deal.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('distributor', 'name businessName')
      .populate('category', 'name')
      .select('name distributor category discountPrice status totalSold createdAt');
    
    const formattedDeals = deals.map(deal => ({
      _id: deal._id,
      name: deal.name || 'Unnamed Deal',
      distributor: deal.distributor?.name || 'Unassigned',
      amount: deal.discountPrice || 0,
      status: deal.status || 'pending',
      category: deal.category?.name || 'Uncategorized',
      totalSold: deal.totalSold || 0,
      createdAt: deal.createdAt
    }));

    res.json(formattedDeals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// {{ Additional CRUD operations can be added here }}

module.exports = router; 