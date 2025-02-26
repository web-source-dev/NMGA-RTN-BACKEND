const express = require('express');
const router = express.Router();
const Log = require('../../models/Logs');

// Route to get all logs
router.get('/', async (req, res) => {
    try {
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

// Route to get logs for a specific user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate userId format (assuming MongoDB ObjectId)
        if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const logs = await Log.find({ user_id: userId })
            .populate('user_id', 'name role')
            .sort({ createdAt: -1 })
            .lean();

        if (logs.length === 0) {
            return res.status(404).json({ message: 'No logs found for this user' });
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
