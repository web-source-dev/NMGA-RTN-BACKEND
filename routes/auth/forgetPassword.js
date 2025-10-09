const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const sendEmail = require('../../utils/email');
const crypto = require('crypto');
const passwordResetEmail = require('../../utils/EmailTemplates/passwordResetEmail');
const { sendAuthMessage } = require('../../utils/message');
const { logSystemAction } = require('../../utils/collaboratorLogger');
require('dotenv').config();
router.post('/', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/login/reset-password/${token}`;
    const emailContent = passwordResetEmail(user.name, resetUrl);

    await sendEmail(user.email, 'Password Reset Request', emailContent);

    if (user.phone) {
      await sendAuthMessage.passwordReset(user.phone, user.name);
    }

    res.status(200).json({ message: 'Email sent' });

    // Log the action
    await logSystemAction('password_reset_requested', 'authentication', {
      message: `Password reset requested for ${user.email}`,
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      resourceId: user._id,
      resourceName: user.name,
      severity: 'medium',
      tags: ['password-reset', 'authentication', 'security'],
      metadata: {
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown',
        resetTokenSent: true,
        tokenExpiry: user.resetPasswordExpires
      }
    });
  } catch (error) {
    console.error('Error in forget password:', error);
    
    // Log failed attempt
    await logSystemAction('password_reset_request_failed', 'authentication', {
      message: `Password reset request failed for email: ${req.body.email}`,
      userEmail: req.body.email,
      error: {
        message: error.message,
        stack: error.stack
      },
      severity: 'medium',
      tags: ['password-reset', 'authentication', 'failed'],
      metadata: {
        ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown'
      }
    });
    
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
