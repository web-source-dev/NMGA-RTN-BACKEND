const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');

router.get('/data/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the hashed password
    console.log('Hashed password:', user.password);

    // bcrypt does not support decrypting hashed passwords back to plain text
    // Instead, you can log the plain text password before hashing it during user creation

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user' });
  }
});

module.exports = router;
