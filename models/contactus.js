const mongoose = require("mongoose");

const contactUsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  user_role: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "resolved"],
    default: "pending"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("ContactUs", contactUsSchema);