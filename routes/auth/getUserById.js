const express = require('express');
const router = express.Router();
const User = require('../../models/User');

router.get('/co-op-member/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.json(user); // ✅ Only one response is sent

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

router.get('/distributor/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        console.log(user);
        return res.json(user); // ✅ Only one response is sent

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

router.get('/profile/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.json(user);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
