const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  description: String,
  size: {
    type: String,
  },
  originalCost: {
    type: Number,
  },
  discountPrice: {
    type: Number,
  },
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  dealEndsAt: {
    type: Date,
  },
  minQtyForDiscount: {
    type: Number,
  },
  images: [{
    type: String,
  }],
  totalSold: {
    type: Number,
    default: 0
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  commitments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Commitment" }],

  views: { type: Number, default: 0 },  // New field
  impressions: { type: Number, default: 0 }, // New field

  notificationHistory: {
    type: Map,
    of: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date }
    }],
    default: new Map()
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Deal", dealSchema);
