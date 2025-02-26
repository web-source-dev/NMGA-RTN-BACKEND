const express = require('express');
const router = express.Router();
const SplashPage = require('../../models/SplashPage');
const { check, validationResult } = require('express-validator');
const moment = require('moment'); // Add moment.js for date handling

// Add validation middleware
const validateSplashPage = [
  check('cards').isArray().withMessage('Cards must be an array'),
  check('cards.*.title').notEmpty().withMessage('Card title is required'),
  check('cards.*.content').notEmpty().withMessage('Card content is required'),
  check('displaySettings').isObject().withMessage('Display settings must be an object'),
  check('scheduling').isObject().withMessage('Scheduling must be an object'),
  check('scheduling.startDate').notEmpty().withMessage('Start date is required'),
  check('scheduling.endDate').notEmpty().withMessage('End date is required'),
  check('targeting').isObject().withMessage('Targeting must be an object'),
];

// Create a new splash page
router.post('/create', validateSplashPage, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const splashPage = new SplashPage({
      ...req.body,
      analytics: {
        views: 0,
        lastViewed: null
      }
    });
    await splashPage.save();
    res.status(201).json(splashPage);
  } catch (error) {
    console.error('Error creating splash page:', error);
    res.status(500).json({ error: 'Failed to create splash page' });
  }
});

// Fetch all splash pages
router.get('/', async (req, res) => {
  try {
    const userRole = req.headers['user-role'] || 'all';
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const splashPages = await SplashPage.find();
    const filteredSplashPages = splashPages.filter(page => {
      const startDate = new Date(page.scheduling.startDate);
      const endDate = new Date(page.scheduling.endDate);
      const startTime = parseInt(page.scheduling.timeOfDay.start.split(':')[0]) * 60 + 
                       parseInt(page.scheduling.timeOfDay.start.split(':')[1]);
      const endTime = parseInt(page.scheduling.timeOfDay.end.split(':')[0]) * 60 + 
                     parseInt(page.scheduling.timeOfDay.end.split(':')[1]);

      // Check if the splash page is active and within the date range
      const isActive = page.isActive && startDate <= now && endDate >= now;

      // Check frequency
      let frequencyValid = true;
      if (page.scheduling.frequency !== 'once') {
        const lastShown = page.analytics?.lastViewed;
        if (lastShown) {
          const lastShownDate = new Date(lastShown);
          switch (page.scheduling.frequency) {
            case 'daily':
              frequencyValid = now.getDate() !== lastShownDate.getDate() ||
                             now.getMonth() !== lastShownDate.getMonth() ||
                             now.getFullYear() !== lastShownDate.getFullYear();
              break;
            case 'weekly':
              const weekDiff = Math.floor((now - lastShownDate) / (7 * 24 * 60 * 60 * 1000));
              frequencyValid = weekDiff >= 1;
              break;
            case 'monthly':
              frequencyValid = now.getMonth() !== lastShownDate.getMonth() ||
                             now.getFullYear() !== lastShownDate.getFullYear();
              break;
          }
        }
      }

      // Check if the current day is valid
      const isDayValid = !page.scheduling.daysOfWeek.length || page.scheduling.daysOfWeek.includes(currentDay);

      // Check time of day
      const isTimeValid = currentTime >= startTime && currentTime <= endTime;

      // Check user roles
      const isUserRoleValid = page.targeting.userRoles.includes(userRole) || page.targeting.userRoles.includes('all');

      return isActive && frequencyValid && isDayValid && isTimeValid && isUserRoleValid;
    });

    res.status(200).json(filteredSplashPages);
  } catch (error) {
    console.error('Error fetching splash pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add these new analytics routes
router.post('/:id/analytics/view', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, deviceInfo } = req.body;
    
    const splash = await SplashPage.findById(id);
    if (!splash) {
      return res.status(404).json({ error: 'Splash page not found' });
    }

    // Update view analytics
    splash.analytics.views += 1;
    
    // Track unique views
    const hasViewed = splash.analytics.viewHistory.some(
      view => view.userId === userId
    );
    if (!hasViewed) {
      splash.analytics.uniqueViews += 1;
    }

    splash.analytics.viewHistory.push({
      timestamp: new Date(),
      userId,
      deviceInfo
    });
    splash.analytics.lastViewed = new Date();

    await splash.save();
    res.status(200).json({ message: 'View analytics updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/analytics/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, timeSpent } = req.body;
    
    const splash = await SplashPage.findById(id);
    if (!splash) {
      return res.status(404).json({ error: 'Splash page not found' });
    }

    splash.analytics.totalCloses += 1;
    splash.analytics.closeRate = 
      (splash.analytics.totalCloses / splash.analytics.views) * 100;

    splash.analytics.closeHistory.push({
      timestamp: new Date(),
      userId,
      timeSpent
    });

    await splash.save();
    res.status(200).json({ message: 'Close analytics updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/analytics/cta', async (req, res) => {
  try {
    const { id } = req.params;
    const { ctaIndex, userId, deviceInfo } = req.body;
    
    const splash = await SplashPage.findById(id);
    if (!splash) {
      return res.status(404).json({ error: 'Splash page not found' });
    }

    const cta = splash.cards[0].ctaButtons[ctaIndex];
    cta.analytics.clicks += 1;

    const hasClicked = cta.analytics.clickHistory.some(
      click => click.userId === userId
    );
    if (!hasClicked) {
      cta.analytics.uniqueClicks += 1;
    }

    cta.analytics.clickHistory.push({
      timestamp: new Date(),
      userId,
      deviceInfo
    });
    cta.analytics.lastClicked = new Date();

    await splash.save();
    res.status(200).json({ message: 'CTA analytics updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this new route to get all splash contents without filtering
router.get('/all', async (req, res) => {
  try {
    const splashPages = await SplashPage.find();
    res.status(200).json(splashPages);
  } catch (error) {
    console.error('Error fetching all splash pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add this route to get a single splash page
router.get('/:id', async (req, res) => {
  try {
    const splashPage = await SplashPage.findById(req.params.id);
    if (!splashPage) {
      return res.status(404).json({ error: 'Splash page not found' });
    }
    res.status(200).json(splashPage);
  } catch (error) {
    console.error('Error fetching splash page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update patch route
router.patch('/:id', validateSplashPage, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const updatedSplashPage = await SplashPage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedSplashPage) {
      return res.status(404).json({ error: 'Splash page not found' });
    }
    res.status(200).json(updatedSplashPage);
  } catch (error) {
    console.error('Error updating splash page:', error);
    res.status(500).json({ error: 'Failed to update splash page' });
  }
});

// Add this route to delete a splash page
router.delete('/:id', async (req, res) => {
  try {
    const deletedSplashPage = await SplashPage.findByIdAndDelete(req.params.id);
    if (!deletedSplashPage) {
      return res.status(404).json({ error: 'Splash page not found' });
    }
    res.status(200).json({ message: 'Splash page deleted successfully' });
  } catch (error) {
    console.error('Error deleting splash page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add this route to get all splash pages
router.get('/splash', async (req, res) => {
  try {
    const splashPages = await SplashPage.find();
    res.status(200).json(splashPages);
  } catch (error) {
    console.error('Error fetching splash pages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
