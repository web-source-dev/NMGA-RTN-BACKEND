const mongoose = require('mongoose');

const commitmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", required: true },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "cancelled"],
      default: "pending"
    },
    distributorResponse: {
      type: String,
      default: ""
    },
    modifiedByDistributor: {
      type: Boolean,
      default: false
    },
    modifiedQuantity: {
      type: Number,
      default: null
    },
    modifiedTotalPrice: {
      type: Number,
      default: null
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    }
  }, { timestamps: true });
  
  module.exports = mongoose.model("Commitment", commitmentSchema);