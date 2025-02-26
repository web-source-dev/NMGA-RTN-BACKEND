const express = require('express');
const router = express.Router();
const ChatMessage = require('../../models/ChatMessage');

// Get all chat messages
router.get('/', async (req, res) => {
  try {
    const messages = await ChatMessage.find().populate('senderId commitmentId');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new chat message
router.post('/', async (req, res) => {
  try {
    const newMessage = new ChatMessage(req.body);
    const savedMessage = await newMessage.save();
    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// {{ Additional CRUD operations can be added here }}

module.exports = router; 