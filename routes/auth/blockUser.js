const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const sendEmail = require('../../utils/email');
const blockUserEmail = require('../../utils/EmailTemplates/blockUserEmail');
const { sendAuthMessage } = require('../../utils/message');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

router.post('/', isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    // Log the action
    await logCollaboratorAction(req, 'block_user', 'user management', {
      targetUserName: user.name,
      targetUserEmail: user.email,
      additionalInfo: 'Account access suspended'
    });

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
    console.error('Error blocking user:', error);
    
    // Log the error
    await logError(req, 'block_user', 'user', error, {
      targetUserId: req.body.userId,
      severity: 'high'
    });
    
    res.status(500).json({ message: 'Error blocking user', success: false });
  }
});

module.exports = router;
