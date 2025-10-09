const express = require('express');
const router = express.Router();
const ChatMessage = require('../../models/ChatMessage');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get all chat messages
router.get('/', async (req, res) => {
  try {
    // Log the action
    await logCollaboratorAction(req, 'view_messages', 'chat messages');
    
    const messages = await ChatMessage.find().populate('senderId commitmentId');
    res.json(messages);
  } catch (err) {
    await logError(req, 'view_messages', 'chat messages', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new chat message
router.post('/', async (req, res) => {
  try {
    const newMessage = new ChatMessage(req.body);
    const savedMessage = await newMessage.save();
    
    // Log the action
    await logCollaboratorAction(req, 'send_message', 'chat message', {
      messageLength: req.body.message?.length || 0,
      commitmentId: req.body.commitmentId,
      resourceId: savedMessage._id
    });
    
    res.status(201).json(savedMessage);
  } catch (err) {
    await logError(req, 'send_message', 'chat message', err, {
      messageLength: req.body.message?.length || 0,
      commitmentId: req.body.commitmentId
    });
    res.status(400).json({ error: err.message });
  }
});

// {{ Additional CRUD operations can be added here }}

module.exports = router; 