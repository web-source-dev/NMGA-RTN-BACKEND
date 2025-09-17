const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Log = require('../../models/Logs');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

router.delete('/:userId', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found', 
        success: false 
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(403).json({ 
        message: 'Cannot delete your own account', 
        success: false 
      });
    }

    // Check if user has any important relationships before deletion
    const userStats = {
      hasCommittedDeals: user.committedDeals && user.committedDeals.length > 0,
      hasAddedMembers: user.addedMembers && user.addedMembers.length > 0,
      hasCollaborators: user.collaborators && user.collaborators.length > 0,
      hasFavorites: user.favorites && user.favorites.length > 0
    };

    // Log the action before deletion
    await logCollaboratorAction(req, 'delete_user', 'user management', {
      targetUserName: user.name,
      targetUserEmail: user.email,
      targetUserRole: user.role,
      userStats: userStats,
      additionalInfo: 'User account permanently deleted'
    });

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Create a log entry for the deletion
    const log = new Log({
      message: `User account deleted: ${user.name} (${user.email}) - Role: ${user.role}`,
      type: 'warning',
      user_id: req.user.id, // Admin who performed the deletion
      metadata: {
        deletedUser: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessName: user.businessName
        },
        userStats: userStats
      }
    });
    await log.save();

    res.json({ 
      message: 'User deleted successfully', 
      success: true,
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    
    // Log the error
    await logCollaboratorAction(req, 'delete_user_failed', 'user management', {
      targetUserId: req.params.userId,
      additionalInfo: `Error: ${error.message}`
    });

    res.status(500).json({ 
      message: 'Error deleting user', 
      success: false 
    });
  }
});

module.exports = router;
