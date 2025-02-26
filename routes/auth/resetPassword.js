const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const passwordChangedEmail = require('../../utils/EmailTemplates/passwordChangedEmail');

router.post('/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset.' });

    const log = new Log({
      message: `Security update: ${user.name} has successfully completed password reset procedure`,
      type: 'success',
      user_id: user._id
    });
    await log.save();

    const emailContent = passwordChangedEmail(user.name);
    await sendEmail(user.email, 'Password Changed Successfully', emailContent);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
