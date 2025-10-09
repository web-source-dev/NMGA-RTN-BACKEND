const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { logSystemAction } = require('../../utils/collaboratorLogger');

router.post('/', async (req, res) => {
  try {
    const userId = req.body.id; // Retrieve user ID from request body

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Log the logout event
    await logSystemAction('user_logout', 'authentication', {
      message: `User logout: ${user.name} (${user.email})`,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      resourceId: user._id,
      resourceName: user.name,
      severity: 'low',
      tags: ['logout', 'authentication', 'session'],
      metadata: {
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown',
        sessionEnded: true
      }
    });

    res.status(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    
    // Log the error
    await logSystemAction('user_logout_failed', 'authentication', {
      message: `Logout failed for user ID: ${req.body.id}`,
      userId: req.body.id,
      error: {
        message: error.message,
        stack: error.stack
      },
      severity: 'medium',
      tags: ['logout', 'authentication', 'failed']
    });
    
    res.status(500).send({ message: 'Error logging out', error });
  }
});

module.exports = router;
