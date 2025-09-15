const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true ,lowercase: true,trim: true},
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
  fax:{
    type: String,
  },
  additionalEmails: [{
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    label: String
  }],
  additionalPhoneNumbers: [{
    number: String,
    label: String
  }],
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
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationOTP: {
    code: String,
    expiresAt: Date
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
  },
  addedMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  collaborators: [{
    name: String,
    email: String,
    role: { 
      type: String, 
      enum: [
        'manager',            // full control of the account 
        'deal_manager',     // create/update/accept/decline deals commitments and also handle assets/media 
        'supplier_manager', // add & manage suppliers
        'media_manager',    // handle assets/media
        'commitment_manager', // manage commitments (esp. for co-op accounts)
        'substore_manager', // manage sub-stores (co-op only)
        'viewer'            // default read-only access
      ], 
      default: 'viewer' 
    },
    password: String,
    status: { type: String, enum: ['active', 'restricted', 'deleted','invited','accepted'], default: 'active' },
    invitationToken: String,
    invitationExpiry: Date
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model("User", userSchema);
