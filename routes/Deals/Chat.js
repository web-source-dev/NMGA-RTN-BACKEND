const express = require('express');
const router = express.Router();
const ChatMessage = require('../../models/ChatMessage');
const Commitment = require('../../models/Commitments');
const User = require('../../models/User');
const Deal = require('../../models/Deals');
const { createNotification } = require('../Common/Notification');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Helper function to check if user has access to the chat
const hasAccessToChat = async (userId, commitment) => {
  if (!commitment || !userId) return false;

  // Get user role
  const user = await User.findById(userId);
  if (!user) return false;

  // Get deal for distributor check
  const deal = await Deal.findById(commitment.dealId);
  if (!deal) return false;

  // Convert IDs to strings for comparison
  const userIdStr = userId.toString();
  const commitmentUserIdStr = commitment.userId._id.toString();
  const dealDistributorIdStr = deal.distributor.toString();

  return (
    user.role === 'admin' ||
    (user.role === 'member' && commitmentUserIdStr === userIdStr) ||
    (user.role === 'distributor' && dealDistributorIdStr === userIdStr)
  );
};

// Get chat messages for a commitment
router.get('/:commitmentId', async (req, res) => {
  try {
    const { commitmentId } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }

    // Find commitment and check access
    const commitment = await Commitment.findById(commitmentId)
      .populate('userId')
      .populate({
        path: 'dealId',
        populate: {
          path: 'distributor',
          select: '_id name role'
        }
      });

    if (!commitment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Commitment not found'
      });
    }

    const hasAccess = await hasAccessToChat(userId, commitment);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this chat'
      });
    }
    
    const messages = await ChatMessage.find({ commitmentId })
      .populate('senderId', 'name role')
      .sort({ createdAt: 1 });
    
    // Log the action
    await logCollaboratorAction(req, 'view_chat_messages', 'chat messages', {
      commitmentId: commitmentId,
      additionalInfo: `Found ${messages.length} messages`
    });
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    await logError(req, 'view_chat_messages', 'chat messages', error, {
      commitmentId: req.params.commitmentId
    });
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to fetch chat messages'
    });
  }
});

// Send a new message
router.post('/:commitmentId', async (req, res) => {
  try {
    const { commitmentId } = req.params;
    const { senderId, message } = req.body;

    if (!senderId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'senderId is required'
      });
    }

    // Find commitment and check access
    const commitment = await Commitment.findById(commitmentId)
      .populate('userId')
      .populate({
        path: 'dealId',
        populate: {
          path: 'distributor',
          select: '_id name role'
        }
      });

    if (!commitment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Commitment not found'
      });
    }

    const hasAccess = await hasAccessToChat(senderId, commitment);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to send messages in this chat'
      });
    }

    // Create and save the message
    const chatMessage = await ChatMessage.create({
      commitmentId,
      senderId,
      message
    });

    // Populate sender info before sending response
    await chatMessage.populate('senderId', 'name role');

    // Log the action
    await logCollaboratorAction(req, 'send_chat_message', 'chat message', {
      commitmentId: commitmentId,
      messageLength: message.length,
      additionalInfo: `Message sent in chat for deal "${commitment.dealId.name}"`
    });

    // Determine recipient based on sender's role
    const sender = await User.findById(senderId);
    let recipientId;
    let notificationTitle;
    let notificationMessage;

    if (sender.role === 'distributor') {
      recipientId = commitment.userId._id;
      notificationTitle = 'New Message from Distributor';
      notificationMessage = `${sender.name} sent a message regarding your commitment for "${commitment.dealId.name}"`;
    } else {
      recipientId = commitment.dealId.distributor._id;
      notificationTitle = 'New Message from Member';
      notificationMessage = `${sender.name} sent a message regarding their commitment for "${commitment.dealId.name}"`;
    }

    // Create notification for the recipient
    await createNotification({
      recipientId,
      senderId,
      type: 'chat',
      subType: 'new_message',
      title: notificationTitle,
      message: notificationMessage,
      relatedId: chatMessage._id,
      onModel: 'ChatMessage',
      priority: 'high'
    });

    // Also notify admin about new message
    await createNotification({
      recipientId: commitment.dealId.distributor._id, // Admin notification
      senderId,
      type: 'chat',
      subType: 'new_message',
      title: 'New Chat Message',
      message: `New message in chat between ${sender.name} and ${commitment.dealId.distributor.name} for deal "${commitment.dealId.name}"`,
      relatedId: chatMessage._id,
      onModel: 'ChatMessage',
      priority: 'low'
    });

    res.json(chatMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    await logError(req, 'send_chat_message', 'chat message', error, {
      commitmentId: req.params.commitmentId,
      senderId: req.body.senderId
    });
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to send message'
    });
  }
});

// Mark messages as read
router.put('/:commitmentId/read', async (req, res) => {
  try {
    const { commitmentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required'
      });
    }

    // Find commitment and check access
    const commitment = await Commitment.findById(commitmentId)
      .populate('userId')
      .populate({
        path: 'dealId',
        populate: {
          path: 'distributor',
          select: '_id name role'
        }
      });

    if (!commitment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Commitment not found'
      });
    }

    const hasAccess = await hasAccessToChat(userId, commitment);
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this chat'
      });
    }

    const unreadMessages = await ChatMessage.find({
      commitmentId,
      senderId: { $ne: userId },
      isRead: false
    }).populate('senderId', 'name role');

    if (unreadMessages.length > 0) {
      // Update messages as read
      await ChatMessage.updateMany(
        { 
          commitmentId,
          senderId: { $ne: userId },
          isRead: false
        },
        { isRead: true }
      );

      // Create notification for the sender about messages being read
      const reader = await User.findById(userId);
      for (const msg of unreadMessages) {
        await createNotification({
          recipientId: msg.senderId._id,
          senderId: userId,
          type: 'chat',
          subType: 'unread_message',
          title: 'Messages Read',
          message: `${reader.name} has read your messages in the chat for deal "${commitment.dealId.name}"`,
          relatedId: msg._id,
          onModel: 'ChatMessage',
          priority: 'low'
        });
      }
    }

    // Log the action
    await logCollaboratorAction(req, 'mark_messages_read', 'chat messages', {
      commitmentId: commitmentId,
      additionalInfo: `Marked ${unreadMessages.length} messages as read`
    });

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    await logError(req, 'mark_messages_read', 'chat messages', error, {
      commitmentId: req.params.commitmentId,
      userId: req.body.userId
    });
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to mark messages as read'
    });
  }
});

module.exports = router; 