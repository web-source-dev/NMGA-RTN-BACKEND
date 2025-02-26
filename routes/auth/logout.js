const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');
const User = require('../../models/User');

router.post('/', async (req, res) => {
  try {
    const userId = req.body.id; // Retrieve user ID from request body

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Log the logout event
    await Log.create({
      message: `Session terminated: ${user.name} has successfully ended their system access`,
      type: 'success',
      user_id: userId
    });

    res.status(200).send({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error logging out', error });
  }
});

module.exports = router;
