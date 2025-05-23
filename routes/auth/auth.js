const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { createNotification } = require('../Common/Notification');

const register = require('./register');
router.use('/register', register);

const login = require('./login');
router.use('/login', login);

const forgetPassword = require('./forgetPassword');
router.use('/forget-password', forgetPassword);

const resetPassword = require('./resetPassword');
router.use('/reset-password', resetPassword);

const getAllUsers = require('./getAllUsers');
router.use('/users', getAllUsers);

const blockUser = require('./blockUser');
router.use('/block-user', blockUser);

const unblockUser = require('./unblockUser');
router.use('/unblock-user', unblockUser);

const getUser = require('./GetUser');
router.use('/user', getUser);

const getUserById = require('./getUserById');
router.use('/v2', getUserById);

const addUser = require('./addUser');
router.use('/add', addUser);

const logout = require('./logout');
router.use('/logout', logout);

// Verify password reset token from invitation
router.get('/verify-password-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }
    
    // Return user data (excluding sensitive information)
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        businessName: user.businessName
      }
    });
  } catch (error) {
    console.error('Error verifying password token:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while verifying token'
    });
  }
});

// Create password for newly added member
router.post('/create-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    // Find user with this token and valid expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Update user with new password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isVerified = true; // Mark as verified
    
    await user.save();
    
    // Send notification to parent user
    if (user.addedBy) {
      const parentUser = await User.findById(user.addedBy);
      if (parentUser) {
        const notificationMessage = `${user.name} has completed their registration and can now access NMGA.`;
        await createNotification({
          recipient: parentUser._id,
          message: notificationMessage,
          type: 'MEMBER_REGISTRATION_COMPLETE',
          relatedId: user._id
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Password has been created successfully'
    });
  } catch (error) {
    console.error('Error creating password:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating password'
    });
  }
});

module.exports = router;
