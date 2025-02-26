const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

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

// Analytics and reporting routes
router.use('/analytics', require('./AnalyticsRoute'));

// Use routes
router.use('/user-stats', userStatsRoute);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

router.use(limiter);

// Add error handling middleware
router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;
