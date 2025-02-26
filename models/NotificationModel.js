const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: [
      'auth', // login, logout, register
      'deal', // create, update, delete, status change
      'favorite', // add, remove
      'commitment', // new, status change
      'chat' // new message, unread message
    ],
    required: true
  },
  subType: {
    type: String,
    enum: [
      'login',
      'logout',
      'register',
      'deal_created',
      'deal_updated',
      'deal_deleted',
      'deal_status_changed',
      'favorite_added',
      'favorite_removed',
      'commitment_created',
      'commitment_status_changed',
      'new_message',
      'unread_message'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'onModel'
  },
  onModel: {
    type: String,
    enum: ['Deal', 'Commitment', 'ChatMessage', 'User']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1, subType: 1 });
notificationSchema.index({ isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
