const express = require("express");
const Favorite = require("../../models/Favorite");
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { createNotification } = require('../Common/Notification');
const { isAuthenticated, isMemberAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

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
        await logCollaboratorAction(req, 'remove_favorite', 'favorite', {
          dealTitle: deal.name,
          dealId: dealId,
          resourceId: dealId
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
        await logCollaboratorAction(req, 'add_favorite', 'favorite', {
          dealTitle: deal.name,
          dealId: dealId,
          resourceId: dealId
        });
  
        const updatedFavorites = await Favorite.find({ userId: user_id }).select("dealId");
        return res.json({
          message: "Deal added to favorites",
          favorites: updatedFavorites.map((fav) => fav.dealId),
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      await logError(req, 'toggle_favorite', 'favorite', error, {
        dealId: req.body.dealId
      });
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
      await logError(req, 'view_favorites', 'favorites', error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "An error occurred while fetching favorites" 
      });
    }
  });
  

module.exports = router;
