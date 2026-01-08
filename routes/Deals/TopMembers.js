const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');
const { isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get all members with commitment details (admin only)
router.get('/all-members/:userRole', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

    // Only admin can access this endpoint
    if (req.params.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Get query parameters
    const { month, year, commitmentFilter } = req.query;

    // Get all members
    const members = await User.find({ role: 'member' })
      .select('name email businessName contactPerson phone address logo')
      .lean();

    // Get commitments with deal details for all members
    const commitments = await Commitment.find({
      userId: { $in: members.map(m => m._id) }
    })
    .populate({
      path: 'dealId',
      select: 'name description images category status dealStartAt dealEndsAt commitmentStartAt commitmentEndsAt'
    })
    .select('userId dealId totalPrice status sizeCommitments createdAt')
    .sort({ createdAt: -1 })
    .lean();

    // Group commitments by member
    const commitmentsByMember = {};
    commitments.forEach(commitment => {
      const memberId = commitment.userId.toString();
      if (!commitmentsByMember[memberId]) {
        commitmentsByMember[memberId] = [];
      }
      commitmentsByMember[memberId].push(commitment);
    });

    // Process members with commitment data
    const membersWithCommitments = members.map(member => {
      const memberCommitments = commitmentsByMember[member._id.toString()] || [];

      // Filter by month/year if provided
      let filteredCommitments = memberCommitments;
      if (month && year) {
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        filteredCommitments = memberCommitments.filter(commitment => {
          const commitDate = new Date(commitment.createdAt);
          return commitDate.getMonth() + 1 === monthNum && commitDate.getFullYear() === yearNum;
        });
      }

      // Calculate statistics
      const totalCommitments = filteredCommitments.length;
      const totalSpent = filteredCommitments.reduce((sum, c) => sum + (c.totalPrice || 0), 0);
      const approvedCommitments = filteredCommitments.filter(c => c.status === 'approved').length;
      const pendingCommitments = filteredCommitments.filter(c => c.status === 'pending').length;

      // Get unique deals
      const uniqueDeals = [...new Set(filteredCommitments.map(c => c.dealId?._id?.toString()).filter(Boolean))];

      return {
        ...member,
        commitments: filteredCommitments,
        stats: {
          totalCommitments,
          totalSpent,
          approvedCommitments,
          pendingCommitments,
          uniqueDeals: uniqueDeals.length,
          hasCommitments: totalCommitments > 0
        }
      };
    });

    // Apply commitment filter
    let filteredMembers = membersWithCommitments;
    if (commitmentFilter === 'with_commitments') {
      filteredMembers = membersWithCommitments.filter(m => m.stats.hasCommitments);
    } else if (commitmentFilter === 'without_commitments') {
      filteredMembers = membersWithCommitments.filter(m => !m.stats.hasCommitments);
    }

    await logCollaboratorAction(req, 'view_all_members', 'members', {
      totalMembers: filteredMembers.length,
      totalUnfiltered: membersWithCommitments.length,
      filters: { month, year, commitmentFilter },
      additionalInfo: 'Admin viewed all members list with commitment details'
    });

    return res.status(200).json({
      members: filteredMembers,
      summary: {
        totalMembers: filteredMembers.length,
        membersWithCommitments: membersWithCommitments.filter(m => m.stats.hasCommitments).length,
        membersWithoutCommitments: membersWithCommitments.filter(m => !m.stats.hasCommitments).length,
        totalCommitments: membersWithCommitments.reduce((sum, m) => sum + m.stats.totalCommitments, 0),
        totalSpent: membersWithCommitments.reduce((sum, m) => sum + m.stats.totalSpent, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching members:', error);

    // Log the error
    await logError(req, 'view_all_members', 'members', error);

    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get member details with commitments (admin only)
router.get('/member-details/:memberId/:userRole', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;
    const { memberId } = req.params;

    // Only admin can access this endpoint
    if (req.params.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Get member details
    const member = await User.findById(memberId)
      .select('name email businessName contactPerson phone address logo')
      .lean();

    if (!member) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found' 
      });
    }

    // Get member's commitments with deal details
    const commitments = await Commitment.find({ userId: memberId })
      .populate({
        path: 'dealId',
        select: 'name description discountPrice originalCost images'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total spent and total commitments
    const totalSpent = commitments.reduce((sum, commitment) => 
      sum + (commitment.totalPrice || 0), 0);
    
    // Log the action
    await logCollaboratorAction(req, 'view_member_details_admin', 'member', { 
      memberId: memberId,
      memberName: member.name,
      memberEmail: member.email,
      totalCommitments: commitments.length,
      totalSpent: totalSpent,
      additionalInfo: 'Admin viewed detailed member information'
    });

    return res.status(200).json({
      success: true,
      member,
      commitments,
      stats: {
        totalCommitments: commitments.length,
        totalSpent
      }
    });
  } catch (error) {
    console.error('Error fetching member details:', error);
    
    // Log the error
    await logError(req, 'view_member_details_admin', 'member', error, {
      memberId: req.params.memberId
    });
    
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Get top 5 members based on commitment activity (admin only)
router.get('/top-members/:userRole', isAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const adminId = currentUser.id;

    // Only admin can access this endpoint
    if (req.params.userRole !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Aggregate to find members with the most commitments and highest spending
    const topMembersByCommitments = await Commitment.aggregate([
      { $group: {
          _id: '$userId',
          totalCommitments: { $sum: 1 },
          totalSpent: { $sum: '$totalPrice' }
        }
      },
      { $sort: { totalCommitments: -1, totalSpent: -1 } },
      { $limit: 5 }
    ]);

    // Get the user details for these top members
    const memberIds = topMembersByCommitments.map(item => item._id);
    const topMembers = await User.find({ _id: { $in: memberIds } })
      .select('name email businessName contactPerson phone address logo')
      .lean();

    // Combine user details with their stats
    const result = topMembers.map(member => {
      const stats = topMembersByCommitments.find(item => 
        item._id.toString() === member._id.toString()
      );
      return {
        ...member,
        stats: {
          totalCommitments: stats.totalCommitments,
          totalSpent: stats.totalSpent
        }
      };
    });

    // Sort the final result by total commitments
    result.sort((a, b) => b.stats.totalCommitments - a.stats.totalCommitments);

    // Log the action
    await logCollaboratorAction(req, 'view_top_members', 'members', { 
      topMembersCount: result.length,
      additionalInfo: 'Admin viewed top performing members'
    });

    return res.status(200).json({ 
      success: true,
      topMembers: result 
    });
  } catch (error) {
    console.error('Error fetching top members:', error);
    
    // Log the error
    await logError(req, 'view_top_members', 'members', error);
    
    return res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;
