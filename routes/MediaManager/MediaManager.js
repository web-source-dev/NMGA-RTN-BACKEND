const express = require("express");
const router = express.Router();
const { Media, Folder } = require("../../models/MediaManager");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// Configure multer storage using Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "media-library",
    resource_type: "auto"
  }
});


const upload = multer({ storage: storage });

// Get all media for a user (with pagination and filtering)
router.get("/media/:user_id", async (req, res) => {
  try {
    const { page = 1, limit = 20, type, search, folder = "root", sortBy = "createdAt", sortOrder = "desc" } = req.query;
    
    const query = { 
      userId: req.params.user_id,
      isArchived: false
    };
    
    if (folder) {
      query.folderId = folder;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    
    const media = await Media.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
      
    const count = await Media.countDocuments(query);
    
    res.status(200).json({
      media,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalItems: count
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single media item by ID
router.get("/media/:id/:user_id", async (req, res) => {
  try {
    const media = await Media.findOne({ 
      _id: req.params.id,
      userId: req.params.user_id
    });
    
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    
    res.status(200).json(media);
  } catch (error) {
    console.error("Error fetching media item:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Upload a media file
router.post("/upload/:user_id", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const { originalname, mimetype, size } = req.file;
    const { folderId = "root", tags = [] } = req.body;
    
    // Determine file type based on mimetype
    let type = "other";
    if (mimetype.startsWith("image/")) {
      type = "image";
    } else if (mimetype.startsWith("video/")) {
      type = "video";
    } else if (mimetype.startsWith("application/")) {
      type = "document";
    }
    
    // Create media record
    const media = new Media({
      userId: req.params.user_id,
      name: originalname,
      url: req.file.path,
      type,
      mimeType: mimetype,
      size,
      folderId,
      tags: Array.isArray(tags) ? tags : tags.split(",").map(tag => tag.trim()),
      metadata: {
        publicId: req.file.filename,
        width: req.file.width,
        height: req.file.height,
        duration: req.file.duration
      }
    });
    
    await media.save();
    
    res.status(201).json(media);
  } catch (error) {
    console.error("Error uploading media:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Direct upload route for when files are already uploaded to Cloudinary 
// through the frontend component
router.post("/upload/direct/:user_id", async (req, res) => {
  try {
    const { name, url, type, folderId = "root", tags = [], isPinned = false, isPublic = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }
    
    // Create media record directly
    const media = new Media({
      userId: req.params.user_id,
      name,
      url,
      type: type || "image", // Default to image if not specified
      folderId,
      tags: Array.isArray(tags) ? tags : tags.split(",").map(tag => tag.trim()),
      isPinned,
      isPublic,
      metadata: {
        publicId: url.split('/').pop().split('.')[0] // Extract public ID from URL
      }
    });
    
    await media.save();
    
    res.status(201).json(media);
  } catch (error) {
    console.error("Error with direct upload:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a media item
router.put("/media/:id/:user_id", async (req, res) => {
  try {
    const { name, folderId, tags, isArchived, isPinned, isPublic } = req.body;
    
    const media = await Media.findOne({
      _id: req.params.id,
      userId: req.params.user_id
    });
    
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    
    if (name) media.name = name;
    if (folderId) media.folderId = folderId;
    if (tags) media.tags = Array.isArray(tags) ? tags : tags.split(",").map(tag => tag.trim());
    if (isArchived !== undefined) media.isArchived = isArchived;
    if (isPinned !== undefined) media.isPinned = isPinned;
    if (isPublic !== undefined) media.isPublic = isPublic;
    
    await media.save();
    
    res.status(200).json(media);
  } catch (error) {
    console.error("Error updating media:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a media item
router.delete("/media/:id/:user_id", async (req, res) => {
  try {
    const media = await Media.findOne({
      _id: req.params.id,
      userId: req.params.user_id
    });
    
    if (!media) {
      return res.status(404).json({ message: "Media not found" });
    }
    
    // Delete from Cloudinary if we have the publicId
    if (media.metadata && media.metadata.publicId) {
      await cloudinary.uploader.destroy(media.metadata.publicId);
    }
    
    await Media.deleteOne({ _id: req.params.id });
    
    res.status(200).json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Error deleting media:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create a folder
router.post("/folders/:user_id", async (req, res) => {
  try {
    const { name, parentId = "root", color } = req.body;
    
    const folder = new Folder({
      userId: req.params.user_id,
      name,
      parentId,
      color
    });
    
    await folder.save();
    
    res.status(201).json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all folders for a user
router.get("/folders/:user_id", async (req, res) => {
  try {
    const { parentId } = req.query;
    
    const query = {
      userId: req.params.user_id,
      isArchived: false
    };
    
    // Only filter by parentId if it was explicitly provided
    if (parentId) {
      query.parentId = parentId;
    }
    
    const folders = await Folder.find(query);
    
    res.status(200).json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a folder
router.put("/folders/:id/:user_id", async (req, res) => {
  try {
    const { name, parentId, color, isArchived } = req.body;
    
    console.log(`Updating folder ${req.params.id} with data:`, req.body);
    
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.params.user_id
    });
    
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    
    if (name) folder.name = name;
    if (parentId) folder.parentId = parentId;
    if (color) folder.color = color;
    if (isArchived !== undefined) folder.isArchived = isArchived;
    
    const updatedFolder = await folder.save();
    console.log("Folder updated successfully:", updatedFolder);
    
    res.status(200).json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a folder
router.delete("/folders/:id/:user_id", async (req, res) => {
  try {
    console.log(`Request to delete folder ${req.params.id}`);
    
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: req.params.user_id
    });
    
    if (!folder) {
      return res.status(404).json({ message: "Folder not found" });
    }
    
    console.log(`Found folder to delete: ${folder.name} (parent: ${folder.parentId})`);
    
    // Find and update any subfolders to move them to parent
    const subfolders = await Folder.find({ 
      parentId: req.params.id,
      userId: req.params.user_id 
    });
    
    if (subfolders.length > 0) {
      console.log(`Moving ${subfolders.length} subfolders to parent ${folder.parentId}`);
      
      // Move all subfolders to parent folder
      await Folder.updateMany(
        { parentId: req.params.id, userId: req.params.user_id },
        { parentId: folder.parentId }
      );
    }
    
    // Move all media in this folder to parent folder
    const mediaUpdated = await Media.updateMany(
      { folderId: req.params.id, userId: req.params.user_id },
      { folderId: folder.parentId }
    );
    
    console.log(`Moved ${mediaUpdated.modifiedCount} media items to parent folder`);
    
    // Delete the folder
    const deleteResult = await Folder.deleteOne({ _id: req.params.id });
    console.log("Delete result:", deleteResult);
    
    res.status(200).json({ 
      message: "Folder deleted successfully",
      subfoldersMoved: subfolders.length,
      mediaMoved: mediaUpdated.modifiedCount
    });
  } catch (error) {
    console.error("Error deleting folder:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get media statistics
router.get("/stats/:user_id", async (req, res) => {
  try {
    const stats = {
      total: await Media.countDocuments({ userId: req.params.user_id }),
      images: await Media.countDocuments({ userId: req.params.user_id, type: "image" }),
      videos: await Media.countDocuments({ userId: req.params.user_id, type: "video" }),
      documents: await Media.countDocuments({ userId: req.params.user_id, type: "document" }),
      others: await Media.countDocuments({ userId: req.params.user_id, type: "other" }),
      folders: await Folder.countDocuments({ userId: req.params.user_id, isArchived: false })
    };
    
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching media stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
