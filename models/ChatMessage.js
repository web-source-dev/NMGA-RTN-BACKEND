const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  commitmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commitment',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema); 