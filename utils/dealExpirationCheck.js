const Deal = require('../models/Deals');
const mongoose = require('mongoose');
const { isFeatureEnabled } = require('../config/features');

const checkDealExpiration = async () => {
  try {
    // Check if deal expiration feature is enabled
    if (!(await isFeatureEnabled('DEAL_EXPIRATION'))) {
      console.log('⏰ Deal expiration check feature is disabled');
      return;
    }

    // Verify database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping deal expiration check.');
      return;
    }

    const currentDate = new Date();

    // Find deals where dealEndsAt has passed and status is still active
    const expiredDeals = await Deal.find({
      dealEndsAt: { $lt: currentDate },
      status: 'active'
    });

    if (expiredDeals.length > 0) {
      // Mark all expired deals as inactive - no logging, no notifications, no emails
      for (const deal of expiredDeals) {
        deal.status = 'inactive';
        await deal.save();
      }
      console.log(`✅ Marked ${expiredDeals.length} expired deal(s) as inactive`);
    }

  } catch (error) {
    console.error('Error in deal expiration check:', error);
  }
};

module.exports = checkDealExpiration; 