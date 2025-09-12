const express = require("express");
const Favorite = require("../../models/Favorite");
const Log = require("../../models/Logs");
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { createNotification } = require('../Common/Notification');
const { isAuthenticated, isMemberAdmin, getCurrentUserContext } = require('../../middleware/auth');

// Toggle favorite (Add/Remove)
router.post("/toggle", isMemberAdmin, async (req, res) => {
    try {
      const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
      const { dealId } = req.body;
      const user_id = currentUser.id;
  
      if (!user_id) {
        return res.status(400).json({ 
          error: "User ID is required",
          message: "Please log in to add favorites" 
        });
      }
  
      const deal = await Deal.findById(dealId).populate('distributor', 'name _id');
      const user = await User.findById(user_id);
      
      if (!deal || !user) {
        return res.status(404).json({ 
          error: "Not found",
          message: "Deal or user not found" 
        });
      }
  
      const existingFavorite = await Favorite.findOne({ userId: user_id, dealId });
  
      if (existingFavorite) {
        await Favorite.deleteOne({ _id: existingFavorite._id });
        
        // Notify distributor about removed favorite
        await createNotification({
          recipientId: deal.distributor._id,
          senderId: user_id,
          type: 'favorite',
          subType: 'favorite_removed',
          title: 'Deal Removed from Favorites',
          message: `${user.name} has removed your deal "${deal.name}" from their favorites`,
          relatedId: deal._id,
          onModel: 'Deal',
          priority: 'low'
        });

        // Log the action
        let logMessage;
        if (isImpersonating) {
          logMessage = `Admin ${originalUser.name} (${originalUser.email}) removed deal "${deal.name}" from favorites on behalf of member ${currentUser.name} (${currentUser.email})`;
        } else {
          logMessage = `${currentUser.name} removed deal "${deal.name}" from favorites`;
        }

        await Log.create({
          message: logMessage,
          type: 'info',
          user_id: currentUser.id // Always the member's ID, whether admin is impersonating or not
        });
  
        const updatedFavorites = await Favorite.find({ userId: user_id }).select("dealId");
        return res.json({
          message: "Deal removed from favorites",
          favorites: updatedFavorites.map((fav) => fav.dealId),
        });
      } else {
        await Favorite.create({ userId: user_id, dealId });
        
        // Notify distributor about new favorite
        await createNotification({
          recipientId: deal.distributor._id,
          senderId: user_id,
          type: 'favorite',
          subType: 'favorite_added',
          title: 'Deal Added to Favorites',
          message: `${user.name} has added your deal "${deal.name}" to their favorites`,
          relatedId: deal._id,
          onModel: 'Deal',
          priority: 'medium'
        });

        // Log the action
        let logMessage;
        if (isImpersonating) {
          logMessage = `Admin ${originalUser.name} (${originalUser.email}) added deal "${deal.name}" to favorites on behalf of member ${currentUser.name} (${currentUser.email})`;
        } else {
          logMessage = `${currentUser.name} added deal "${deal.name}" to favorites`;
        }

        await Log.create({
          message: logMessage,
          type: 'info',
          user_id: currentUser.id // Always the member's ID, whether admin is impersonating or not
        });
  
        const updatedFavorites = await Favorite.find({ userId: user_id }).select("dealId");
        return res.json({
          message: "Deal added to favorites",
          favorites: updatedFavorites.map((fav) => fav.dealId),
        });
      }
    } catch (error) {
      const { currentUser } = getCurrentUserContext(req);
      await Log.create({
        message: `Error managing favorites for user ${currentUser?.name || 'unknown'} - ${error.message}`,
        type: 'error',
        user_id: currentUser.id
      });
      console.error("Error toggling favorite:", error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "An error occurred while updating favorites" 
      });
    }
});

// Get user's favorite deals
router.get("/", isAuthenticated, async (req, res) => {
    try {
      const { currentUser } = getCurrentUserContext(req);
      const user_id = currentUser.id;
      
      const favorites = await Favorite.find({ userId: user_id }).select("dealId");
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "An error occurred while fetching favorites" 
      });
    }
  });
  

module.exports = router;
