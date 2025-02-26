const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');

router.get('/', async (req, res) => {
  try {
    const deals = await Deal.find()
      .populate('distributor', 'name email businessName contactPerson phone logo')
      .select('-notificationHistory'); // Exclude notification history for security
    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deals', error });
  }
});

router.get('/buy', async (req, res) => {
  try {
    // Increment impressions for all active deals being displayed
    const deals = await Deal.find({ status: 'active' })
      .populate('distributor', 'name email businessName contactPerson phone logo');
    
    // Update impressions in bulk
    await Promise.all(
      deals.map(deal => 
        Deal.findByIdAndUpdate(deal._id, { $inc: { impressions: 1 } })
      )
    );

    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deals', error });
  }
});

module.exports = router;
