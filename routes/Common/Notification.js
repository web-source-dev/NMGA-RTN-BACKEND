const express = require('express');
const router = express.Router();
const Notification = require('../../models/NotificationModel');
const User = require('../../models/User');

// Helper function to create notifications
const createNotification = async ({
  recipientId,
  senderId = null,
  type,
  subType,
  title,
  message,
  relatedId = null,
  onModel = null,
  priority = 'medium'
}) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      subType,
      title,
      message,
      relatedId,
      onModel,
      priority
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Helper function to notify all users of a specific role
const notifyUsersByRole = async (role, notificationData) => {
  try {
    const users = await User.find({ role });
    const notifications = [];
    
    for (const user of users) {
      const notification = await createNotification({
        ...notificationData,
        recipientId: user._id
      });
      notifications.push(notification);
    }
    
    return notifications;
  } catch (error) {
    console.error('Error notifying users by role:', error);
    throw error;
  }
};

// Get notifications for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, unreadOnly = false } = req.query;
    
    const query = { recipient: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'name role')
      .populate('recipient', 'name role');
    
    const total = await Notification.countDocuments(query);
    
    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notifications as read
router.put('/read', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { isRead: true } }
    );
    
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mark notifications as read'
    });
  }
});

// Delete notifications
router.delete('/', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    await Notification.deleteMany({ _id: { $in: notificationIds } });
    
    res.json({ message: 'Notifications deleted successfully' });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete notifications'
    });
  }
});

// Get unread notification count
router.get('/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get notification count'
    });
  }
});

// Export the helper functions and router
module.exports = {
  router,
  createNotification,
  notifyUsersByRole
};
