const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../utils/email');
const passwordChangedEmail = require('../../utils/EmailTemplates/passwordChangedEmail');
const { logSystemAction } = require('../../utils/collaboratorLogger');

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

    // Send response first to prevent headers issue
    res.status(200).json({ message: 'Password has been reset.' });

    // Perform logging and email sending asynchronously
    setImmediate(async () => {
      try {
        // Log the action
        await logSystemAction('password_reset_successful', 'authentication', {
          message: `Password reset successful: ${user.name} (${user.email})`,
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
            resetMethod: 'token'
          }
        });

        const emailContent = passwordChangedEmail(user.name);
        await sendEmail(user.email, 'Password Changed Successfully', emailContent);
      } catch (error) {
        console.error('Error logging or sending email:', error);
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
