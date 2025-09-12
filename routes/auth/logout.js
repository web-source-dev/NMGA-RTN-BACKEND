const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');
const User = require('../../models/User');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

router.post('/', async (req, res) => {
  try {
    const userId = req.body.id; // Retrieve user ID from request body

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Log the logout event
    await logCollaboratorAction(req, 'logout', 'user session', {
      targetUserName: user.name,
      targetUserEmail: user.email
    });

    res.status(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error logging out', error });
  }
});

module.exports = router;
