const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const blockUserEmail = require('../../utils/EmailTemplates/blockUserEmail');
const { sendAuthMessage } = require('../../utils/message');

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true });

    const log = new Log({
      message: `Account access suspended: ${user.name}'s account has been temporarily deactivated by administrator`,
      type: 'warning',
      user_id: user._id
    });
    await log.save();

    const emailContent = blockUserEmail(user.name);
    await sendEmail(user.email, 'Account Blocked', emailContent);

    if (user.phone) {
      const userInfo = {
        name: user.name,
        businessName: user.businessName,
        reason: req.body.reason || 'Administrative action'
      };
      
      try {
        await sendAuthMessage.accountBlocked(user.phone, userInfo);
      } catch (error) {
        console.error('Block notification SMS failed:', error);
      }
    }

    res.json({ message: 'User blocked successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error blocking user', success: false });
  }
});

module.exports = router;
