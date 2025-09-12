const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

router.get('/', isAdmin, async (req, res) => {
  try {
    // Log the action
    await logCollaboratorAction(req, 'view_all_users', 'users list');
    
    const users = await User.find({});
    res.json({ users, message: 'Users fetched successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', success: false });
  }
});

module.exports = router;
