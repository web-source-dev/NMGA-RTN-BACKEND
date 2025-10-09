const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

router.post('/', isAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    // Validate input
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID and new password are required'
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from resetting their own password
    if (req.user.id === userId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot reset your own password. Use the regular password reset feature.'
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear any existing reset tokens
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isVerified = true; // Ensure user is verified after admin reset
    
    await user.save();

    // Log the admin action
    await logCollaboratorAction(req, 'admin_reset_password', 'password management', {
      targetUserName: user.name,
      targetUserEmail: user.email,
      targetUserRole: user.role,
      additionalInfo: 'Password reset by administrator'
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    
    // Log the error
    await logError(req, 'admin_reset_password', 'password', error, {
      targetUserId: req.body.userId,
      severity: 'high',
      tags: ['password-reset', 'admin', 'security']
    });

    res.status(500).json({
      success: false,
      message: 'An error occurred while resetting password'
    });
  }
});

module.exports = router;
