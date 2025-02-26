const express = require('express');
const router = express.Router();
const NotificationModel = require('../../models/NotificationModel');
const WebSocket = require('ws');

let wss;

// Initialize WebSocket server if not already initialized
const initializeWebSocket = (server) => {
    if (!wss) {
        wss = new WebSocket.Server({ server });
        
        wss.on('connection', (ws) => {
            console.log('New client connected to notifications WebSocket');
            
            ws.on('close', () => {
                console.log('Client disconnected from notifications WebSocket');
            });
        });
    }
    return wss;
};

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

// Get recent notifications with better formatting
router.get('/recent', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 5, 20);
        const notifications = await NotificationModel.find()
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

        res.json(formattedNotifications);
    } catch (error) {
        console.error('Error fetching recent notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await NotificationModel.findByIdAndUpdate(
            req.params.id,
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

// Create new notification
router.post('/', async (req, res) => {
    try {
        const notification = new NotificationModel({
            title: req.body.title,
            message: req.body.message,
            userId: req.body.userId,
            type: req.body.type
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

// Get unread notifications count
router.get('/unread/count', async (req, res) => {
    try {
        const count = await NotificationModel.countDocuments({ isRead: false });
        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread notifications count:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        const notification = await NotificationModel.findByIdAndDelete(req.params.id);
        
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