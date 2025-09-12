const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');
// Get all deals
router.get('/', isAdmin, async (req, res) => {
  try {
    // Log the action
    await logCollaboratorAction(req, 'view_all_deals', 'deals list');
    
    const deals = await Deal.find().populate('distributor commitments');
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new deal
router.post('/', isAdmin, async (req, res) => {
  try {
    const newDeal = new Deal(req.body);
    const savedDeal = await newDeal.save();
    
    // Log the action
    await logCollaboratorAction(req, 'create_deal', 'deal', {
      dealTitle: req.body.name || 'Untitled Deal',
      dealCategory: req.body.category,
      dealPrice: req.body.discountPrice
    });
    
    res.status(201).json(savedDeal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get recent deals endpoint
router.get('/recent', isAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    
    // Log the action
    await logCollaboratorAction(req, 'view_recent_deals', 'recent deals', {
      limit: limit
    });
    
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