const mongoose = require("mongoose");

const compareItemSchema = new mongoose.Schema({
  memberId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  memberName: { 
    type: String
  },
  commitmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Commitment"
  },
  size: { 
    type: String, 
    required: true 
  },
  committedQuantity: { 
    type: Number, 
    required: true 
  },
  actualQuantity: { 
    type: Number, 
    required: true 
  },
  committedPrice: { 
    type: Number, 
    required: true 
  },
  actualPrice: { 
    type: Number, 
    required: true 
  },
  quantityDifference: { 
    type: Number
  },
  priceDifference: { 
    type: Number
  }
});

const compareSchema = new mongoose.Schema({
  dealId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Deal", 
    required: true 
  },
  distributorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  dealName: {
    type: String
  },
  fileName: {
    type: String
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  comparisonItems: [compareItemSchema],
  summary: {
    totalCommittedQuantity: { type: Number, default: 0 },
    totalActualQuantity: { type: Number, default: 0 },
    totalCommittedPrice: { type: Number, default: 0 },
    totalActualPrice: { type: Number, default: 0 },
    quantityDifferenceTotal: { type: Number, default: 0 },
    priceDifferenceTotal: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model("Compare", compareSchema);
