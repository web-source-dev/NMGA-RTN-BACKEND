const express = require("express");
const router = express.Router();
const { Media, Folder } = require("../../models/MediaManager");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const mongoose = require("mongoose");
const { isAuthenticated, getCurrentUserContext } = require("../../middleware/auth");
const { logCollaboratorAction } = require("../../utils/collaboratorLogger");

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

// Get all media for the current user (with pagination and filtering)
router.get("/media", isAuthenticated, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { page = 1, limit = 20, type, search, folder = "root", sortBy = "createdAt", sortOrder = "desc" } = req.query;
    
    const query = { 
      userId: userId,
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
    
    // Log the action
    await logCollaboratorAction(req, 'view_media_library', 'media', { 
      totalItems: count,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      folder: folder,
      type: type,
      search: search,
      additionalInfo: `Viewed media library with ${count} items`
    });
    
    res.status(200).json({
      media,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalItems: count
    });
  } catch (error) {
    console.error("Error fetching media:", error);
    await logCollaboratorAction(req, 'view_media_library_failed', 'media', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single media item by ID
router.get("/media/:id", isAuthenticated, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const media = await Media.findOne({ 
      _id: req.params.id,
      userId: userId
    });
    
    if (!media) {
      await logCollaboratorAction(req, 'view_media_item_failed', 'media', { 
        mediaId: req.params.id,
        additionalInfo: 'Media item not found'
      });
      return res.status(404).json({ message: "Media not found" });
    }
    
    await logCollaboratorAction(req, 'view_media_item', 'media', { 
      mediaId: req.params.id,
      mediaName: media.name,
      mediaType: media.type,
      additionalInfo: `Viewed media item: ${media.name}`
    });
    
    res.status(200).json(media);
  } catch (error) {
    console.error("Error fetching media item:", error);
    await logCollaboratorAction(req, 'view_media_item_failed', 'media', { 
      mediaId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Upload a media file
router.post("/upload", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    if (!req.file) {
      await logCollaboratorAction(req, 'upload_media_failed', 'media', { 
        additionalInfo: 'No file uploaded'
      });
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
      userId: userId,
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
    
    await logCollaboratorAction(req, 'upload_media', 'media', { 
      mediaId: media._id,
      mediaName: media.name,
      mediaType: media.type,
      fileSize: media.size,
      folderId: media.folderId,
      additionalInfo: `Uploaded media file: ${media.name} (${media.type})`
    });
    
    res.status(201).json(media);
  } catch (error) {
    console.error("Error uploading media:", error);
    await logCollaboratorAction(req, 'upload_media_failed', 'media', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Direct upload route for when files are already uploaded to Cloudinary 
// through the frontend component
router.post("/upload/direct", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { name, url, type, folderId = "root", tags = [], isPinned = false, isPublic = false } = req.body;
    
    if (!url) {
      await logCollaboratorAction(req, 'upload_media_direct_failed', 'media', { 
        additionalInfo: 'URL is required for direct upload'
      });
      return res.status(400).json({ message: "URL is required" });
    }
    
    // Create media record directly
    const media = new Media({
      userId: userId,
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
    
    await logCollaboratorAction(req, 'upload_media_direct', 'media', { 
      mediaId: media._id,
      mediaName: media.name,
      mediaType: media.type,
      folderId: media.folderId,
      additionalInfo: `Direct uploaded media: ${media.name} (${media.type})`
    });
    
    res.status(201).json(media);
  } catch (error) {
    console.error("Error with direct upload:", error);
    await logCollaboratorAction(req, 'upload_media_direct_failed', 'media', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a media item
router.put("/media/:id", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { name, folderId, tags, isArchived, isPinned, isPublic } = req.body;
    
    const media = await Media.findOne({
      _id: req.params.id,
      userId: userId
    });
    
    if (!media) {
      await logCollaboratorAction(req, 'update_media_failed', 'media', { 
        mediaId: req.params.id,
        additionalInfo: 'Media item not found'
      });
      return res.status(404).json({ message: "Media not found" });
    }
    
    const oldName = media.name;
    const oldFolderId = media.folderId;
    
    if (name) media.name = name;
    if (folderId) media.folderId = folderId;
    if (tags) media.tags = Array.isArray(tags) ? tags : tags.split(",").map(tag => tag.trim());
    if (isArchived !== undefined) media.isArchived = isArchived;
    if (isPinned !== undefined) media.isPinned = isPinned;
    if (isPublic !== undefined) media.isPublic = isPublic;
    
    await media.save();
    
    await logCollaboratorAction(req, 'update_media', 'media', { 
      mediaId: req.params.id,
      mediaName: media.name,
      oldName: oldName,
      oldFolderId: oldFolderId,
      newFolderId: media.folderId,
      additionalInfo: `Updated media item: ${media.name}`
    });
    
    res.status(200).json(media);
  } catch (error) {
    console.error("Error updating media:", error);
    await logCollaboratorAction(req, 'update_media_failed', 'media', { 
      mediaId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a media item
router.delete("/media/:id", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const media = await Media.findOne({
      _id: req.params.id,
      userId: userId
    });
    
    if (!media) {
      await logCollaboratorAction(req, 'delete_media_failed', 'media', { 
        mediaId: req.params.id,
        additionalInfo: 'Media item not found'
      });
      return res.status(404).json({ message: "Media not found" });
    }
    
    const mediaName = media.name;
    const mediaType = media.type;
    
    // Delete from Cloudinary if we have the publicId
    if (media.metadata && media.metadata.publicId) {
      await cloudinary.uploader.destroy(media.metadata.publicId);
    }
    
    await Media.deleteOne({ _id: req.params.id });
    
    await logCollaboratorAction(req, 'delete_media', 'media', { 
      mediaId: req.params.id,
      mediaName: mediaName,
      mediaType: mediaType,
      additionalInfo: `Deleted media item: ${mediaName} (${mediaType})`
    });
    
    res.status(200).json({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Error deleting media:", error);
    await logCollaboratorAction(req, 'delete_media_failed', 'media', { 
      mediaId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create a folder
router.post("/folders", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { name, parentId = "root", color } = req.body;
    
    const folder = new Folder({
      userId: userId,
      name,
      parentId,
      color
    });
    
    await folder.save();
    
    await logCollaboratorAction(req, 'create_folder', 'folder', { 
      folderId: folder._id,
      folderName: folder.name,
      parentId: folder.parentId,
      color: folder.color,
      additionalInfo: `Created folder: ${folder.name}`
    });
    
    res.status(201).json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    await logCollaboratorAction(req, 'create_folder_failed', 'folder', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all folders for the current user
router.get("/folders", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { parentId } = req.query;
    
    const query = {
      userId: userId,
      isArchived: false
    };
    
    // Only filter by parentId if it was explicitly provided
    if (parentId) {
      query.parentId = parentId;
    }
    
    const folders = await Folder.find(query);
    
    await logCollaboratorAction(req, 'view_folders', 'folders', { 
      totalFolders: folders.length,
      parentId: parentId,
      additionalInfo: `Viewed ${folders.length} folders`
    });
    
    res.status(200).json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    await logCollaboratorAction(req, 'view_folders_failed', 'folders', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update a folder
router.put("/folders/:id", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    const { name, parentId, color, isArchived } = req.body;
    
    console.log(`Updating folder ${req.params.id} with data:`, req.body);
    
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: userId
    });
    
    if (!folder) {
      await logCollaboratorAction(req, 'update_folder_failed', 'folder', { 
        folderId: req.params.id,
        additionalInfo: 'Folder not found'
      });
      return res.status(404).json({ message: "Folder not found" });
    }
    
    const oldName = folder.name;
    const oldParentId = folder.parentId;
    const oldColor = folder.color;
    
    if (name) folder.name = name;
    if (parentId) folder.parentId = parentId;
    if (color) folder.color = color;
    if (isArchived !== undefined) folder.isArchived = isArchived;
    
    const updatedFolder = await folder.save();
    console.log("Folder updated successfully:", updatedFolder);
    
    await logCollaboratorAction(req, 'update_folder', 'folder', { 
      folderId: req.params.id,
      folderName: updatedFolder.name,
      oldName: oldName,
      oldParentId: oldParentId,
      newParentId: updatedFolder.parentId,
      oldColor: oldColor,
      newColor: updatedFolder.color,
      additionalInfo: `Updated folder: ${updatedFolder.name}`
    });
    
    res.status(200).json(updatedFolder);
  } catch (error) {
    console.error("Error updating folder:", error);
    await logCollaboratorAction(req, 'update_folder_failed', 'folder', { 
      folderId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a folder
router.delete("/folders/:id", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    console.log(`Request to delete folder ${req.params.id}`);
    
    const folder = await Folder.findOne({
      _id: req.params.id,
      userId: userId
    });
    
    if (!folder) {
      await logCollaboratorAction(req, 'delete_folder_failed', 'folder', { 
        folderId: req.params.id,
        additionalInfo: 'Folder not found'
      });
      return res.status(404).json({ message: "Folder not found" });
    }
    
    console.log(`Found folder to delete: ${folder.name} (parent: ${folder.parentId})`);
    
    // Find and update any subfolders to move them to parent
    const subfolders = await Folder.find({ 
      parentId: req.params.id,
      userId: userId 
    });
    
    if (subfolders.length > 0) {
      console.log(`Moving ${subfolders.length} subfolders to parent ${folder.parentId}`);
      
      // Move all subfolders to parent folder
      await Folder.updateMany(
        { parentId: req.params.id, userId: userId },
        { parentId: folder.parentId }
      );
    }
    
    // Move all media in this folder to parent folder
    const mediaUpdated = await Media.updateMany(
      { folderId: req.params.id, userId: userId },
      { folderId: folder.parentId }
    );
    
    console.log(`Moved ${mediaUpdated.modifiedCount} media items to parent folder`);
    
    // Delete the folder
    const deleteResult = await Folder.deleteOne({ _id: req.params.id });
    console.log("Delete result:", deleteResult);
    
    await logCollaboratorAction(req, 'delete_folder', 'folder', { 
      folderId: req.params.id,
      folderName: folder.name,
      subfoldersMoved: subfolders.length,
      mediaMoved: mediaUpdated.modifiedCount,
      additionalInfo: `Deleted folder: ${folder.name} (moved ${subfolders.length} subfolders, ${mediaUpdated.modifiedCount} media items)`
    });
    
    res.status(200).json({ 
      message: "Folder deleted successfully",
      subfoldersMoved: subfolders.length,
      mediaMoved: mediaUpdated.modifiedCount
    });
  } catch (error) {
    console.error("Error deleting folder:", error);
    await logCollaboratorAction(req, 'delete_folder_failed', 'folder', { 
      folderId: req.params.id,
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get media statistics
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const stats = {
      total: await Media.countDocuments({ userId: userId }),
      images: await Media.countDocuments({ userId: userId, type: "image" }),
      videos: await Media.countDocuments({ userId: userId, type: "video" }),
      documents: await Media.countDocuments({ userId: userId, type: "document" }),
      others: await Media.countDocuments({ userId: userId, type: "other" }),
      folders: await Folder.countDocuments({ userId: userId, isArchived: false })
    };
    
    await logCollaboratorAction(req, 'view_media_stats', 'media', { 
      totalMedia: stats.total,
      images: stats.images,
      videos: stats.videos,
      documents: stats.documents,
      others: stats.others,
      folders: stats.folders,
      additionalInfo: `Viewed media statistics: ${stats.total} total items, ${stats.folders} folders`
    });
    
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching media stats:", error);
    await logCollaboratorAction(req, 'view_media_stats_failed', 'media', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
