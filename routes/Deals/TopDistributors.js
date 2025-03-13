const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');

// Get all distributors with their performance metrics
router.get('/all-distributors/:userRole', async (req, res) => {
  try {
    if (req.params.userRole !== 'admin' && req.params.userRole !== 'distributor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const distributors = await User.find({ role: 'distributor' })
      .select('name email businessName contactPerson phone address logo')
      .lean();

    return res.status(200).json({ distributors });
  } catch (error) {
    console.error('Error fetching distributors:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get top 5 distributors based on deals and commitments
router.get('/top-distributors/:userRole', async (req, res) => {
  try {
    if (req.params.userRole !== 'admin' && req.params.userRole !== 'distributor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all distributors
    const distributors = await User.find({ role: 'distributor' })
      .select('name email businessName contactPerson phone address logo')
      .lean();

    // Get deals for each distributor
    const distributorStats = await Promise.all(
      distributors.map(async (distributor) => {
        // Get all deals by this distributor
        const deals = await Deal.find({ distributor: distributor._id }).lean();
        
        // Get all commitments for these deals
        const dealIds = deals.map(deal => deal._id);
        const commitments = await Commitment.find({
          dealId: { $in: dealIds }
        }).lean();

        // Calculate statistics
        const totalDeals = deals.length;
        const activeDeals = deals.filter(deal => deal.status === 'active').length;
        const totalCommitments = commitments.length;
        const totalSpent = commitments.reduce((sum, commitment) => sum + (commitment.totalPrice || 0), 0);

        return {
          ...distributor,
          stats: {
            totalDeals,
            activeDeals,
            totalCommitments,
            totalSpent
          }
        };
      })
    );

    // Sort by total deals and commitments
    distributorStats.sort((a, b) => {
      if (b.stats.totalDeals !== a.stats.totalDeals) {
        return b.stats.totalDeals - a.stats.totalDeals;
      }
      return b.stats.totalCommitments - a.stats.totalCommitments;
    });

    // Get top 5
    const topMembers = distributorStats.slice(0, 5);

    return res.status(200).json({ topMembers });
  } catch (error) {
    console.error('Error fetching top distributors:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;