const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Core system routes
router.use('/logs', require('./LogRoute'));
router.use('/announcements', require('./Announcment'));

// User management routes
const userStatsRoute = require('./UserStatsRoute');

// Deal management routes
router.use('/deals', require('./DealRoute'));
router.use('/deal-analytics', require('./DealAnalyticsRoute'));

// Communication routes
router.use('/chat-messages', require('./ChatMessageRoute'));
router.use('/notifications', require('./NotificationRoute'));

// Financial routes
router.use('/payments', require('./PaymentRoute'));

// Engagement routes
router.use('/commitments', require('./CommitmentRoute'));

// Content routes
router.use('/latest-deals', require('./latest4Deals'));

// Analytics and reporting routes
router.use('/analytics', require('./AnalyticsRoute'));

// Feature management routes
router.use('/features', require('./FeatureManagement'));


// Use routes
router.use('/user-stats', userStatsRoute);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

router.use(limiter);

// Add error handling middleware
router.use(async (err, req, res, next) => {
  console.error(err.stack);
  
  // Log the error
  try {
    await logCollaboratorAction(req, 'system_error', 'error handling', {
      additionalInfo: `Error: ${err.message}`,
      errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } catch (logError) {
    console.error('Error logging system error:', logError);
  }
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;
