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
    // First, check if it's a main user account
    let user = await User.findOne({ email: email.toLowerCase() });
    let isCollaborator = false;
    let collaboratorData = null;
    let mainUser = null;
    let collaboratorIndex = -1;

    // If not found in main users, check collaborators
    if (!user) {
      const usersWithCollaborators = await User.find({
        'collaborators.email': email.toLowerCase()
      });

      for (const userDoc of usersWithCollaborators) {
        const collaborator = userDoc.collaborators.find(
          collab => collab.email.toLowerCase() === email.toLowerCase()
        );
        
        if (collaborator && (collaborator.status === 'active' || collaborator.status === 'accepted')) {
          isCollaborator = true;
          collaboratorData = collaborator;
          mainUser = userDoc;
          collaboratorIndex = userDoc.collaborators.findIndex(
            collab => collab.email.toLowerCase() === email.toLowerCase()
          );
          break;
        }
      }

      if (!isCollaborator) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour

    // Handle collaborator password reset
    if (isCollaborator && mainUser) {
      // Update collaborator's reset token
      mainUser.collaborators[collaboratorIndex].resetPasswordToken = token;
      mainUser.collaborators[collaboratorIndex].resetPasswordExpires = expiresAt;
      await mainUser.save();

      const resetUrl = `${process.env.FRONTEND_URL}/login/reset-password/${token}?type=collaborator`;
      const emailContent = passwordResetEmail(collaboratorData.name, resetUrl);

      await sendEmail(collaboratorData.email, 'Password Reset Request', emailContent);

      res.status(200).json({ message: 'Email sent' });

      // Log the action
      await logSystemAction('password_reset_requested', 'authentication', {
        message: `Password reset requested for collaborator ${collaboratorData.email}`,
        userId: mainUser._id,
        userName: mainUser.name,
        userEmail: collaboratorData.email,
        userRole: 'collaborator',
        resourceId: mainUser._id,
        resourceName: mainUser.name,
        severity: 'medium',
        tags: ['password-reset', 'authentication', 'security', 'collaborator'],
        metadata: {
          collaboratorName: collaboratorData.name,
          collaboratorEmail: collaboratorData.email,
          collaboratorRole: collaboratorData.role,
          mainAccountName: mainUser.name,
          mainAccountEmail: mainUser.email,
          ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
          userAgent: req.headers['user-agent'] || 'Unknown',
          resetTokenSent: true,
          tokenExpiry: expiresAt
        }
      });
    } else {
      // Handle main user password reset
      user.resetPasswordToken = token;
      user.resetPasswordExpires = expiresAt;
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
    }
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
