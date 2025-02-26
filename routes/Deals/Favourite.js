const express = require("express");
const Favorite = require("../../models/Favorite");
const Log = require("../../models/Logs");
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const { createNotification } = require('../Common/Notification');

// Toggle favorite (Add/Remove)
router.post("/toggle", async (req, res) => {
    try {
      const { dealId, user_id } = req.body;
  
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

        await Log.create({
          message: `${user.name} removed deal "${deal.name}" from favorites`,
          type: 'info',
          user_id: user_id
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

        await Log.create({
          message: `${user.name} added deal "${deal.name}" to favorites`,
          type: 'info',
          user_id: user_id
        });
  
        const updatedFavorites = await Favorite.find({ userId: user_id }).select("dealId");
        return res.json({
          message: "Deal added to favorites",
          favorites: updatedFavorites.map((fav) => fav.dealId),
        });
      }
    } catch (error) {
      await Log.create({
        message: `Error managing favorites for user ${user?.name || 'unknown'} - ${error.message}`,
        type: 'error',
        user_id: req.body.user_id
      });
      console.error("Error toggling favorite:", error);
      res.status(500).json({ 
        error: "Internal Server Error",
        message: "An error occurred while updating favorites" 
      });
    }
});

// Get user's favorite deals
router.get("/", async (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) {
        return res.status(400).json({ 
          error: "User ID is required",
          message: "Please log in to view favorites" 
        });
      }
  
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
