const mongoose = require('mongoose');

const commitmentStatusChangeSchema = new mongoose.Schema({
  commitmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commitment',
    required: true
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dealName: {
    type: String,
    required: true
  },
  distributorName: {
    type: String,
    required: true
  },
  distributorEmail: {
    type: String,
    required: true
  },
  previousStatus: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'cancelled'],
    default: 'pending'
  },
  newStatus: {
    type: String,
    enum: ['approved', 'declined'],
    required: true
  },
  distributorResponse: {
    type: String,
    default: ''
  },
  commitmentDetails: {
    sizeCommitments: [{
      size: String,
      name: String,
      quantity: Number,
      pricePerUnit: Number,
      totalPrice: Number,
      appliedDiscountTier: {
        tierQuantity: Number,
        tierDiscount: Number
      }
    }],
    totalPrice: Number,
    quantity: Number
  },
  processedForEmail: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: String,
    enum: ['distributor', 'admin'],
    required: true
  },
  processedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
commitmentStatusChangeSchema.index({ userId: 1, createdAt: 1 });
commitmentStatusChangeSchema.index({ processedForEmail: 1, createdAt: 1 });

module.exports = mongoose.model('CommitmentStatusChange', commitmentStatusChangeSchema);
