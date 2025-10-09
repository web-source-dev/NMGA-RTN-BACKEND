const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction, logError, logWithChanges } = require('../../utils/collaboratorLogger');

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

    // Log the action before deletion with full user details
    await logCollaboratorAction(req, 'delete_user', 'user', {
      targetUserName: user.name,
      targetUserEmail: user.email,
      targetUserRole: user.role,
      resourceId: user._id,
      resourceName: user.name,
      severity: 'critical',
      tags: ['deletion', 'user-management', 'permanent'],
      metadata: {
        deletedUser: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          businessName: user.businessName,
          contactPerson: user.contactPerson,
          phone: user.phone
        },
        userStats: userStats,
        hasActiveRelationships: Object.values(userStats).some(v => v === true)
      },
      additionalInfo: 'User account permanently deleted'
    });

    // Delete the user
    await User.findByIdAndDelete(userId);

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
    await logError(req, 'delete_user', 'user', error, {
      targetUserId: req.params.userId,
      severity: 'critical',
      tags: ['deletion', 'user-management', 'failed']
    });

    res.status(500).json({ 
      message: 'Error deleting user', 
      success: false 
    });
  }
});

module.exports = router;
