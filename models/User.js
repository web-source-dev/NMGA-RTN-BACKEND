const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: {
    type: String,
    enum: ["member", "distributor", "admin"],
    default: "member",
  },
  businessName: {
    type: String,
  },
  contactPerson: {
    type: String,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  logo: {
    type: String,
    default: ""
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  login_key:{
    type: String,
    default: null
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  committedDeals: [{ type: mongoose.Schema.Types.ObjectId, ref: "Commitment" }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "SplashPage"
  }],
  splashPagePreferences: {
    autoPlay: {
      type: Boolean,
      default: true
    },
    muted: {
      type: Boolean,
      default: true
    },
    showOnLogin: {
      type: Boolean,
      default: true
    },
    dismissedSplashes: [{
      splashId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SplashPage"
      },
      dismissedAt: Date
    }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
