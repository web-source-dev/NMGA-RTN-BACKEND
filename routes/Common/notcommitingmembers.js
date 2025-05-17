const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');

// Get members who haven't committed to any deals in the past month
router.get('/not-committing/:adminId', async (req, res) => {
  try {
    // Get admin ID from request params
    const { adminId } = req.params;
    
    // Verify admin exists and has admin role
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Admin access required' 
      });
    }

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
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching inactive members' 
    });
  }
});

// Update user status (inactivate member)
router.put('/inactivate/:userId/:adminId', async (req, res) => {
  try {
    // Get admin ID from request params
    const { userId, adminId } = req.params;
    
    // Verify admin exists and has admin role
    const admin = await User.findOne({ _id: adminId, role: 'admin' });
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: Admin access required' 
      });
    }
    
    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isBlocked: true },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ 
      success: true, 
      message: 'User inactivated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error("Error inactivating user:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error while inactivating user' 
    });
  }
});

module.exports = router;
