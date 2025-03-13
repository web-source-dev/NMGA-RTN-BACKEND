const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');

// Get all members
router.get('/all-members/:userRole', async (req, res) => {
  try {
    // Only admin and distributor can access this endpoint
    if (req.params.userRole !== 'admin' && req.params.userRole !== 'distributor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const members = await User.find({ role: 'member' })
      .select('name email businessName contactPerson phone address logo')
      .lean();

    return res.status(200).json({ members });
  } catch (error) {
    console.error('Error fetching members:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get member details with commitments
router.get('/member-details/:memberId/:userRole', async (req, res) => {
  try {
    // Only admin and distributor can access this endpoint
    if (req.params.userRole !== 'admin' && req.params.userRole !== 'distributor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { memberId } = req.params;

    // Get member details
    const member = await User.findById(memberId)
      .select('name email businessName contactPerson phone address logo')
      .lean();

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
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
    
    return res.status(200).json({
      member,
      commitments,
      stats: {
        totalCommitments: commitments.length,
        totalSpent
      }
    });
  } catch (error) {
    console.error('Error fetching member details:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get top 5 members based on commitment activity
router.get('/top-members/:userRole', async (req, res) => {
    try {
      // Only admin and distributor can access this endpoint
      if (req.params.userRole !== 'admin' && req.params.userRole !== 'distributor') {
        return res.status(403).json({ message: 'Access denied' });
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
  
      return res.status(200).json({ topMembers: result });
    } catch (error) {
      console.error('Error fetching top members:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });

 
  
module.exports = router;
