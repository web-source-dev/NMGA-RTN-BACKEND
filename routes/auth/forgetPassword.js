const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const sendEmail = require('../../utils/email');
const crypto = require('crypto');
const Log = require('../../models/Logs'); // Add this line to require the Logs model
const passwordResetEmail = require('../../utils/EmailTemplates/passwordResetEmail');
const { sendAuthMessage } = require('../../utils/message');
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

    const log = new Log({
      message: `Password reset link sent to ${user.email}`,
      type: 'info',
      user_id: user._id
    });
    await log.save();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
