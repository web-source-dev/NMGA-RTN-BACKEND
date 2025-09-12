const express = require('express');
const router = express.Router();
const NotificationModel = require('../../models/NotificationModel');
const { isAuthenticated, getCurrentUserContext } = require('../../middleware/auth');
const WebSocket = require('ws');

let wss;
// Broadcast notification to all connected clients
const broadcastNotification = (notification) => {
    if (wss) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(notification));
            }
        });
    }
};

// Get recent notifications for current user (supports admin impersonation)
router.get('/recent', isAuthenticated, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const notifications = await NotificationModel.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('recipient', 'name role')
            .populate('sender', 'name role')
            .select('title message isRead createdAt type priority relatedId');

        const formattedNotifications = notifications.map(notification => ({
            _id: notification._id,
            title: notification.title || 'System Notification',
            message: notification.message,
            isRead: notification.isRead || false,
            createdAt: notification.createdAt,
            type: notification.type || 'info',
            priority: notification.priority || 'normal',
            sender: notification.sender ? {
                name: notification.sender.name,
                role: notification.sender.role
            } : { name: 'System', role: 'system' },
            recipient: notification.recipient ? {
                name: notification.recipient.name,
                role: notification.recipient.role
            } : null,
            relatedId: notification.relatedId
        }));

        // Return the array directly for admin dashboard compatibility
        res.json(formattedNotifications);
    } catch (error) {
        console.error('Error fetching recent notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read (supports admin impersonation)
router.put('/:id/read', isAuthenticated, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        const notification = await NotificationModel.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: userId
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new notification (supports admin impersonation)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const senderId = currentUser.id;
        
        const notification = new NotificationModel({
            title: req.body.title,
            message: req.body.message,
            recipient: req.body.recipientId || senderId, // Default to sender if no recipient specified
            sender: senderId,
            type: req.body.type || 'info',
            priority: req.body.priority || 'medium'
        });

        const savedNotification = await notification.save();
        
        // Broadcast to WebSocket clients
        broadcastNotification(savedNotification);

        res.status(201).json(savedNotification);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unread notifications count for current user (supports admin impersonation)
router.get('/unread/count', isAuthenticated, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        const count = await NotificationModel.countDocuments({ 
            recipient: userId,
            isRead: false 
        });
        
        res.json({ count, isImpersonating });
    } catch (error) {
        console.error('Error fetching unread notifications count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete notification (supports admin impersonation)
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
        const userId = currentUser.id;
        
        const notification = await NotificationModel.findOneAndDelete({
            _id: req.params.id,
            recipient: userId
        });
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 