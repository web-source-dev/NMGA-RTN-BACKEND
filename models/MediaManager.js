const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["image", "video", "document", "other"],
    required: true
  },
  mimeType: {
    type: String
  },
  size: {
    type: Number
  },
  folderId: {
    type: String,
    default: "root"
  },
  tags: [String],
  metadata: {
    width: Number,
    height: Number,
    duration: Number,
    publicId: String,
    assetId: String
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessRights: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    permission: {
      type: String,
      enum: ["view", "edit", "admin"],
      default: "view"
    }
  }]
}, {
  timestamps: true
});

const folderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: {
    type: String,
    required: true
  },
  parentId: {
    type: String,
    default: "root"
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: "#1976d2"
  }
}, {
  timestamps: true
});

const Media = mongoose.model("Media", mediaSchema);
const Folder = mongoose.model("Folder", folderSchema);

module.exports = { Media, Folder };
