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
    },
    discountTiers: [{
      tierQuantity: {
        type: Number,
      },
      tierDiscount: {
        type: Number, // Absolute price at this tier
      }
    }]
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
  commitmentStartAt: {
    type: Date,
  },
  commitmentEndsAt: {
    type: Date,
  },
  singleStoreDeals: {
    type: String,
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
  },

  // Distributor reminder tracking
  distributorReminders: {
    postingReminders: {
      type: Map,
      of: [{
        reminderType: { type: String, enum: ['5_days', '3_days', '1_day'] },
        sentAt: { type: Date }
      }],
      default: new Map()
    },
    approvalReminders: {
      type: Map,
      of: [{
        reminderType: { type: String, enum: ['5_days_after_commitment'] },
        sentAt: { type: Date }
      }],
      default: new Map()
    }
  },

  // Member reminder tracking
  memberReminders: {
    windowOpeningReminders: {
      type: Map,
      of: [{
        reminderType: { type: String, enum: ['1_day_before_opening'] },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt: { type: Date }
      }],
      default: new Map()
    },
    windowClosingReminders: {
      type: Map,
      of: [{
        reminderType: { type: String, enum: ['5_days_before_closing', '3_days_before_closing', '1_day_before_closing', '1_hour_before_closing'] },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt: { type: Date }
      }],
      default: new Map()
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Deal", dealSchema);
