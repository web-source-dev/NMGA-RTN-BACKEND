const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  description: String,
  sizes: [{
    size: {
      type: String,
      required: true
    },
    originalCost: {
      type: Number,
      required: true
    },
    discountPrice: {
      type: Number,
      required: true
    }
  }],
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
  dealStartAt: {
    type: Date,
  },
  dealEndsAt: {
    type: Date,
  },
  singleStoreDeals: {
    type: String,
  },
  minQtyForDiscount: {
    type: Number,
  },
  discountTiers: [{
    tierQuantity: {
      type: Number,
    },
    tierDiscount: {
      type: Number, // Percentage discount
    }
  }],
  images: [{
    type: String,
  }],
  totalSold: {
    type: Number,
    default: 0
  },
  bulkAction: {
    type: Boolean,
    default: false
  },
  bulkStatus: {
    type: String,
    enum: ['approved', 'rejected'],
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
