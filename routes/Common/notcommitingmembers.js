const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const { isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get members who haven't committed to any deals in the past month (admin only)
router.get('/not-committing/admin', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

    // Calculate date one month ago
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Calculate date three months ago for long-term inactive members
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Find all members who are not blocked
    const allMembers = await User.find({ 
      role: 'member', 
      isBlocked: false 
    })
    .select('_id name email businessName phone address createdAt')
    .lean();

    // Find members who have commitments in the last month
    const activeMembers = await Commitment.find({
      createdAt: { $gte: oneMonthAgo }
    })
    .distinct('userId');

    // Filter members who haven't committed in the last month
    const inactiveMembers = allMembers.filter(member => 
      !activeMembers.some(activeMemberId => 
        activeMemberId.toString() === member._id.toString()
      )
    );

    // Add the last commitment date for each inactive member and categorize them
    const inactiveMembersWithDetails = await Promise.all(inactiveMembers.map(async (member) => {
      // Find the most recent commitment for this member, if any
      const lastCommitment = await Commitment.findOne({ userId: member._id })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean();

      const inactiveDays = lastCommitment 
        ? Math.floor((new Date() - new Date(lastCommitment.createdAt)) / (1000 * 60 * 60 * 24)) 
        : Math.floor((new Date() - new Date(member.createdAt)) / (1000 * 60 * 60 * 24));
      
      // Determine category
      let category;
      if (!lastCommitment) {
        category = 'never_committed';
      } else if (inactiveDays > 90) {
        category = 'long_term_inactive';
      } else if (inactiveDays > 60) {
        category = 'medium_term_inactive';
      } else {
        category = 'recent_inactive';
      }

      return {
        ...member,
        lastCommitmentDate: lastCommitment ? lastCommitment.createdAt : null,
        inactiveDays,
        hasCommitted: !!lastCommitment,
        category
      };
    }));

    // Categorize members for summary statistics
    const neverCommitted = inactiveMembersWithDetails.filter(m => !m.hasCommitted);
    const recentInactive = inactiveMembersWithDetails.filter(m => m.hasCommitted && m.inactiveDays <= 60);
    const mediumTermInactive = inactiveMembersWithDetails.filter(m => m.hasCommitted && m.inactiveDays > 60 && m.inactiveDays <= 90);
    const longTermInactive = inactiveMembersWithDetails.filter(m => m.hasCommitted && m.inactiveDays > 90);

    // Log the action
    await logCollaboratorAction(req, 'view_inactive_members', 'inactive members report', {
      totalInactive: inactiveMembersWithDetails.length,
      neverCommitted: neverCommitted.length,
      recentInactive: recentInactive.length,
      mediumTermInactive: mediumTermInactive.length,
      longTermInactive: longTermInactive.length
    });

    return res.json({ 
      success: true, 
      inactiveMembers: inactiveMembersWithDetails,
      statistics: {
        total: inactiveMembersWithDetails.length,
        neverCommitted: neverCommitted.length,
        recentInactive: recentInactive.length,
        mediumTermInactive: mediumTermInactive.length,
        longTermInactive: longTermInactive.length
      }
    });
  } catch (error) {
    console.error("Error fetching inactive members:", error);
    
    // Log the error
    await logError(req, 'view_inactive_members', 'inactive members report', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching inactive members' 
    });
  }
});

// Get blocked/inactive members (admin only)
router.get('/blocked-members/admin', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

    // Find all blocked members
    const blockedMembers = await User.find({ 
      role: 'member', 
      isBlocked: true 
    })
    .select('_id name email businessName phone address createdAt updatedAt')
    .lean();

    // Add blocked date information
    const blockedMembersWithDetails = blockedMembers.map(member => ({
      ...member,
      blockedAt: member.updatedAt // Assuming updatedAt is when they were blocked
    }));

    // Log the action
    await logCollaboratorAction(req, 'view_blocked_members', 'blocked members report', {
      totalBlocked: blockedMembersWithDetails.length
    });

    return res.json({ 
      success: true, 
      blockedMembers: blockedMembersWithDetails
    });
  } catch (error) {
    console.error("Error fetching blocked members:", error);
    
    // Log the error
    await logError(req, 'view_blocked_members', 'blocked members report', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching blocked members' 
    });
  }
});

// Update user status (inactivate member) - admin only
router.put('/inactivate/:userId/admin', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;
    const { userId } = req.params;
    
    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        isBlocked: true,
        updatedAt: new Date() // Set the blocked date
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Log the action
    await logCollaboratorAction(req, 'block_user', 'user management', {
      targetUserName: updatedUser.name,
      targetUserEmail: updatedUser.email,
      resourceId: updatedUser._id,
      additionalInfo: 'Member inactivated'
    });

    return res.json({ 
      success: true, 
      message: 'User inactivated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error("Error inactivating user:", error);
    
    // Log the error
    await logError(req, 'block_user', 'user management', error, {
      userId: req.params.userId
    });
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while inactivating user' 
    });
  }
});

// Reactivate user (unblock member) - admin only
router.put('/reactivate/:userId/admin', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;
    const { userId } = req.params;
    
    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        isBlocked: false,
        updatedAt: new Date() // Update the timestamp
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Log the action
    await logCollaboratorAction(req, 'unblock_user', 'user management', {
      targetUserName: updatedUser.name,
      targetUserEmail: updatedUser.email,
      resourceId: updatedUser._id,
      additionalInfo: 'Member reactivated'
    });

    return res.json({ 
      success: true, 
      message: 'User reactivated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error("Error reactivating user:", error);
    
    // Log the error
    await logError(req, 'unblock_user', 'user management', error, {
      userId: req.params.userId
    });
    
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while reactivating user' 
    });
  }
});

module.exports = router;
