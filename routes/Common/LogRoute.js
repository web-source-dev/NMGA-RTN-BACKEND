const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');
const { isAuthenticated, isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Route to get all logs - admin only
router.get('/', isAdmin, async (req, res) => {
    try {
        // Log the action
        await logCollaboratorAction(req, 'view_all_logs', 'system logs');
        
        // Add sorting by createdAt in descending order (newest first)
        const logs = await Log.find()
            .populate('user_id', 'name role')
            .sort({ createdAt: -1 })
            .lean(); // Use lean() for better performance since we only need JSON

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System' }
        }));

        res.json(sanitizedLogs);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ 
            message: 'An error occurred while fetching logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Route to get logs for the current user
router.get('/user', isAuthenticated, async (req, res) => {
    try {
        const { currentUser } = getCurrentUserContext(req);
        const userId = currentUser.id;

        // Log the action
        await logCollaboratorAction(req, 'view_user_logs', 'user logs');

        const logs = await Log.find({ user_id: userId })
            .populate('user_id', 'name role')
            .sort({ createdAt: -1 })
            .lean();

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System' }
        }));

        res.json(sanitizedLogs);
    } catch (err) {
        console.error('Error fetching user logs:', err);
        res.status(500).json({ 
            message: 'An error occurred while fetching user logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Route to get logs for a specific user - admin only
router.get('/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId format (assuming MongoDB ObjectId)
        if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Log the action
        await logCollaboratorAction(req, 'view_specific_user_logs', 'user logs', {
            targetUserId: userId
        });

        const logs = await Log.find({ user_id: userId })
            .populate('user_id', 'name role')
            .sort({ createdAt: -1 })
            .lean();

        // Return empty array instead of 404 for no logs found
        if (logs.length === 0) {
            return res.json([]);
        }

        // Map the results to handle null user_id cases
        const sanitizedLogs = logs.map(log => ({
            ...log,
            user_id: log.user_id || { name: 'System', role: 'System' }
        }));

        res.json(sanitizedLogs);
    } catch (err) {
        console.error('Error fetching user logs:', err);
        res.status(500).json({ 
            message: 'An error occurred while fetching user logs',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;
