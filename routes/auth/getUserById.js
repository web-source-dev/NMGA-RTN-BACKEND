const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { isAuthenticated, isAdmin, isDistributorAdmin, isMemberAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Get member profile - accessible by member or admin
router.get('/co-op-member/:id', isMemberAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_member_profile', 'member profile', {
            targetUserId: id
        });
        
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

// Get distributor profile - accessible by distributor or admin
router.get('/distributor/:id', isDistributorAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_distributor_profile', 'distributor profile', {
            targetUserId: id
        });
        
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        console.log(user);
        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

// Get user profile - accessible by authenticated users
router.get('/profile/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_user_profile', 'user profile', {
            targetUserId: id
        });
        
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.json(user);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
