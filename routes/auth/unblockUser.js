const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const unblockUserEmail = require('../../utils/EmailTemplates/unblockUserEmail');
const { sendAuthMessage } = require('../../utils/message');

router.post('/', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true });

    const log = new Log({
      message: `Account access restored: ${user.name}'s account has been reactivated by administrator`,
      type: 'success',
      user_id: user._id
    });
    await log.save();

    const emailContent = unblockUserEmail(user.name);
    await sendEmail(user.email, 'Account Unblocked', emailContent);

    if (user.phone) {
      await sendAuthMessage.accountUnblocked(user.phone, user.name);
    }

    res.json({ message: 'User unblocked successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error unblocking user', success: false });
  }
});

module.exports = router;
