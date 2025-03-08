// Get list of distributors for admin

const express = require('express');
const router = express.Router();
const User = require('../models/User');


router.get('/distributor-list', async (req, res) => {
    try {
        const distributors = await User.find({ role: 'distributor' })
            .select('name email businessName')
            .sort({ businessName: 1, name: 1 });

        res.json({
            success: true,
            distributors
        });
    } catch (error) {
        console.error('Error fetching distributors:', error);
        res.status(500).json({ success: false, message: 'Error fetching distributors' });
    }
}); 

module.exports = router;