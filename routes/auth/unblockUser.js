const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const unblockUserEmail = require('../../utils/EmailTemplates/unblockUserEmail');
const { sendAuthMessage } = require('../../utils/message');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

router.post('/', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    // Log the action
    await logCollaboratorAction(req, 'unblock_user', 'user management', {
      targetUserName: user.name,
      targetUserEmail: user.email,
      additionalInfo: 'Account access restored'
    });

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
