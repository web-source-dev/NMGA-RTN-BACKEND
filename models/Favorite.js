const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Favorite", favoriteSchema);
