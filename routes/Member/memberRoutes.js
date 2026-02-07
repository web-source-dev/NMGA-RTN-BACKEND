const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../../models/User');
const Deal = require('../../models/Deals');
const Commitment = require('../../models/Commitments');
const Favorite = require('../../models/Favorite');
const bcrypt = require('bcryptjs');
const { isMemberAdmin, getCurrentUserContext,isAuthenticated } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const { MONTHS } = require('../../utils/monthMapping');

// Get member stats
router.get('/stats', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    // Get total commitments
    const totalCommitments = await Commitment.countDocuments({ userId });
    
    // Get active commitments
    const activeCommitments = await Commitment.countDocuments({
      userId,
      status: 'pending'
    });
    
    // Get total spent
    const commitments = await Commitment.find({
      userId,
      status: 'approved',
      paymentStatus: 'paid'
    });
    const totalSpent = commitments.reduce((sum, commitment) => 
      sum + (commitment.modifiedTotalPrice || commitment.totalPrice), 0);
    
    // Get favorite deals count
    const favoriteDeals = await Favorite.countDocuments({ userId });
    
    // Get recent activity
    const recentActivity = await Promise.all([
      // Recent commitments
      Commitment.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('dealId', 'name'),
      // Recent favorites
      Favorite.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('dealId', 'name')
    ]);
    
    const activity = [...recentActivity[0], ...recentActivity[1]]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(item => ({
        description: item.dealId ? 
          `${item.status ? 'Committed to' : 'Favorited'} ${item.dealId.name}` : 
          'Deal no longer available',
        timestamp: item.createdAt
      }));

    // Get total commitments by status
    const totalApproved = await Commitment.countDocuments({ userId, status: 'approved' });
    const totalDeclined = await Commitment.countDocuments({ userId, status: 'declined' });
    const totalCancelled = await Commitment.countDocuments({ userId, status: 'cancelled' });

    // Get total number of favorites
    const totalFavorites = await Favorite.countDocuments({ userId });

    // Log the action
    await logCollaboratorAction(req, 'view_member_stats', 'member', { 
      totalCommitments: totalCommitments,
      activeCommitments: activeCommitments,
      totalSpent: totalSpent,
      favoriteDeals: favoriteDeals,
      totalApproved: totalApproved,
      totalDeclined: totalDeclined,
      totalCancelled: totalCancelled,
      totalFavorites: totalFavorites,
      additionalInfo: `Viewed member statistics: ${totalCommitments} commitments, $${totalSpent.toFixed(2)} spent`
    });

    res.json({
      totalCommitments,
      activeCommitments,
      totalSpent,
      favoriteDeals,
      recentActivity: activity,
      totalApproved,
      totalDeclined,
      totalCancelled,
      totalFavorites
    });
  } catch (error) {
    console.error('Error fetching member stats:', error);
    await logError(req, 'view_member_stats', 'member', error);
    res.status(500).json({ message: 'Error fetching member stats' });
  }
});

// Get member commitments
router.get('/commitments', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    // Extract filter parameters
    const {
      dealName,
      quantity,
      status,
      startDate,
      endDate
    } = req.query;
    
    // Build query
    let query = { userId };
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Date range filter - filter by commitment creation date
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      
      query.createdAt = {
        $gte: startDateObj,
        $lte: endDateObj
      };
    } else if (startDate) {
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: startDateObj };
    } else if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      query.createdAt = { $lte: endDateObj };
    }
    
    // Fetch commitments with filters
    let commitments = await Commitment.find(query)
      .sort({ createdAt: -1 })
      .populate('dealId', 'name category commitmentStartAt commitmentEndsAt dealStartAt dealEndsAt')
      .populate('userId', 'name')
      .lean();
    
    // Apply deal name filter (client-side filtering needed for populated field)
    if (dealName && dealName.trim() !== '') {
      const searchTerm = dealName.trim().toLowerCase();
      commitments = commitments.filter(c => 
        c.dealId && c.dealId.name && c.dealId.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply quantity filter (client-side filtering needed for calculated field)
    if (quantity && quantity.trim() !== '') {
      const quantityTerm = quantity.trim();
      commitments = commitments.filter(c => {
        const totalQuantity = c.modifiedByDistributor && c.modifiedSizeCommitments
          ? c.modifiedSizeCommitments.reduce((sum, size) => sum + (size.quantity || 0), 0)
          : c.sizeCommitments.reduce((sum, size) => sum + (size.quantity || 0), 0);
        return totalQuantity.toString().includes(quantityTerm);
      });
    }
    
    // Log the action
    await logCollaboratorAction(req, 'view_member_commitments', 'commitments', { 
      totalCommitments: commitments.length,
      filters: { dealName, quantity, status, startDate, endDate },
      additionalInfo: `Viewed ${commitments.length} member commitments with filters`
    });
    
    res.json(commitments);
  } catch (error) {
    console.error('Error fetching commitments:', error);
    await logError(req, 'view_member_commitments', 'commitments', error);
    res.status(500).json({ message: 'Error fetching commitments' });
  }
});

// Get member favorites
router.get('/favorites', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const favorites = await Favorite.find({ userId })
      .populate({
        path: 'dealId',
        populate: {
          path: 'distributor',
          select: 'businessName'
        }
      });
    
    // Log the action
    await logCollaboratorAction(req, 'view_member_favorites', 'favorites', { 
      totalFavorites: favorites.length,
      additionalInfo: `Viewed ${favorites.length} member favorites`
    });
    
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    await logError(req, 'view_member_favorites', 'favorites', error);
    res.status(500).json({ message: 'Error fetching favorites' });
  }
});

// Remove favorite
router.delete('/favorites/:dealId', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    await Favorite.findOneAndDelete({
      userId,
      dealId: req.params.dealId
    });
    
    // Log the action
    await logCollaboratorAction(req, 'remove_favorite', 'favorite', { 
      dealId: req.params.dealId,
      additionalInfo: `Removed favorite deal: ${req.params.dealId}`
    });
    
    res.json({ message: 'Favorite removed successfully' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    await logError(req, 'remove_favorite', 'favorite', error, {
      dealId: req.params.dealId
    });
    res.status(500).json({ message: 'Error removing favorite' });
  }
});

// Cancel commitment
router.post('/commitments/:commitmentId/cancel', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const commitment = await Commitment.findById(req.params.commitmentId);
    
    if (!commitment) {
      return res.status(404).json({ message: 'Commitment not found' });
    }

    if (commitment.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending commitments can be cancelled' });
    }

    commitment.status = 'cancelled';
    await commitment.save();

    // Log the action
    await logCollaboratorAction(req, 'cancel_commitment', 'commitment', { 
      commitmentId: commitment._id,
      additionalInfo: `Cancelled commitment: ${commitment._id}`
    });
    
    res.json({ message: 'Commitment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling commitment:', error);
    await logError(req, 'cancel_commitment', 'commitment', error, {
      commitmentId: req.params.commitmentId
    });
    res.status(500).json({ message: 'Error cancelling commitment' });
  }
});

// Get member analytics
router.get('/analytics', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    // Get spending trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const commitments = await Commitment.find({
      userId,
      createdAt: { $gte: sixMonthsAgo },
      status: 'approved'
    }).populate('dealId');

    const spendingTrends = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString('default', { month: 'short' });
      const monthCommitments = commitments.filter(c => 
        new Date(c.createdAt).getMonth() === date.getMonth());
      
      const amount = monthCommitments.reduce((sum, c) => 
        sum + (c.modifiedTotalPrice || c.totalPrice), 0);
      
      // Calculate savings based on size commitments
      const savings = monthCommitments.reduce((sum, c) => {
        let originalCost = 0;
        const sizeCommitments = c.modifiedByDistributor ? c.modifiedSizeCommitments : c.sizeCommitments;
        
        if (sizeCommitments && Array.isArray(sizeCommitments)) {
          sizeCommitments.forEach(size => {
            const dealSize = c.dealId.sizes.find(ds => ds.size === size.size);
            if (dealSize) {
              originalCost += dealSize.originalCost * size.quantity;
            }
          });
        }
        
        return sum + (originalCost - (c.modifiedTotalPrice || c.totalPrice));
      }, 0);
      
      return { month, amount, savings };
    }).reverse();

    // Get category distribution
    const deals = await Deal.find({
      _id: { $in: commitments.map(c => c.dealId._id) }
    });
    
    const categoryDistribution = Object.entries(
      deals.reduce((acc, deal) => {
        acc[deal.category] = (acc[deal.category] || 0) + 1;
        return acc;
      }, {})
    ).map(([category, value]) => ({ category, value }));

    // Get commitment status distribution
    const statusCounts = await Commitment.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const commitmentStatus = statusCounts.map(({ _id, count }) => ({
      status: _id,
      value: count
    }));

    // Get monthly activity
    const favorites = await Favorite.find({ userId });
    const monthlyActivity = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toLocaleString('default', { month: 'short' });
      
      return {
        month,
        commitments: commitments.filter(c => 
          new Date(c.createdAt).getMonth() === date.getMonth()).length,
        favorites: favorites.filter(f => 
          new Date(f.createdAt).getMonth() === date.getMonth()).length
      };
    }).reverse();

    // Log the action
    await logCollaboratorAction(req, 'view_member_analytics', 'analytics', { 
      spendingTrends: spendingTrends.length,
      categoryDistribution: categoryDistribution.length,
      commitmentStatus: commitmentStatus.length,
      monthlyActivity: monthlyActivity.length,
      additionalInfo: `Viewed member analytics with ${spendingTrends.length} spending trends`
    });

    res.json({
      spendingTrends,
      categoryDistribution,
      commitmentStatus,
      monthlyActivity
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    await logError(req, 'view_member_analytics', 'analytics', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Get user data
router.get('/user', isAuthenticated, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Log the action
    await logCollaboratorAction(req, 'view_user_profile', 'profile', { 
      userId: userId,
      userName: user.name,
      userEmail: user.email,
      additionalInfo: `Viewed user profile: ${user.name}`
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    await logError(req, 'view_user_profile', 'profile', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Update user data
router.put('/user', isAuthenticated, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the action
    await logCollaboratorAction(req, 'update_user_profile', 'profile', { 
      userId: userId,
      userName: updatedUser.name,
      userEmail: updatedUser.email,
      updatedFields: Object.keys(updates),
      additionalInfo: `Updated user profile: ${updatedUser.name}`
    });

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating user data:', error);
    await logError(req, 'update_user_profile', 'profile', error);
    res.status(500).json({ message: 'Error updating user data' });
  }
});

router.post('/user/password', isAuthenticated, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const { oldPassword, newPassword } = req.body;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare old password with hashed password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user's password
    user.password = hashedPassword;
    await user.save();

    // Log the action
    await logCollaboratorAction(req, 'change_password', 'password', { 
      userId: userId,
      userName: user.name,
      userEmail: user.email,
      additionalInfo: `Changed password for user: ${user.name}`
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    await logError(req, 'change_password', 'password', error);
    res.status(500).json({ message: 'Error updating password' });
  }
});

// Update user avatar
router.post('/user/avatar', isAuthenticated, async (req, res) => {
  try {
      const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
      const userId = currentUser.id;
      
      const { avatar } = req.body; // Get the avatar URL from the request body
      const updatedUser = await User.findByIdAndUpdate(
          userId,
          { logo: avatar }, // Update the logo field with the new avatar URL
          { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Log the action
      await logCollaboratorAction(req, 'update_user_avatar', 'avatar', { 
        userId: userId,
        userName: updatedUser.name,
        userEmail: updatedUser.email,
        additionalInfo: `Updated avatar for user: ${updatedUser.name}`
      });

      res.json({ message: 'Avatar updated successfully', user: updatedUser });
  } catch (error) {
      console.error('Error updating avatar:', error);
      await logError(req, 'update_user_avatar', 'avatar', error);
      res.status(500).json({ message: 'Error updating avatar' });
  }
});
// Update the detailed analytics route
router.get('/detailed-analytics', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const {
      timeRange = 'year',
      startDate,
      endDate,
      categories,
      minAmount,
      maxAmount,
      searchTerm
    } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      const today = new Date();
      let startDate;
      switch (timeRange) {
        case 'month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
          break;
        case 'quarter':
          startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
          break;
        default:
          startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      }
      dateFilter = { createdAt: { $gte: startDate } };
    }

    let matchStage = {
      userId: new mongoose.Types.ObjectId(userId),
      status: 'approved',
      ...dateFilter
    };

    if (minAmount) {
      matchStage.totalPrice = { $gte: parseFloat(minAmount) };
    }
    if (maxAmount) {
      matchStage.totalPrice = { ...matchStage.totalPrice, $lte: parseFloat(maxAmount) };
    }

    // Get spending trends with more detailed data
    const spendingTrends = await Commitment.aggregate([
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: 'deals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal'
        }
      },
      {
        $unwind: '$deal'
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalSpent: { $sum: { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] } },
          count: { $sum: 1 },
          savings: {
            $sum: {
              $cond: {
                if: { $isArray: '$sizeCommitments' },
                then: {
                  $reduce: {
                    input: {
                      $cond: [
                        { $eq: ['$modifiedByDistributor', true] },
                        { $ifNull: ['$modifiedSizeCommitments', '$sizeCommitments'] },
                        '$sizeCommitments'
                      ]
                    },
                    initialValue: 0,
                    in: {
                      $add: ['$$value', { $multiply: ['$$this.quantity', '$$this.pricePerUnit'] }]
                    }
                  }
                },
                else: {
                  $subtract: [
                    { $multiply: ['$deal.originalCost', { $ifNull: ['$modifiedQuantity', '$quantity'] }] },
                    { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                  ]
                }
              }
            }
          },
          averageDiscount: {
            $avg: {
              $divide: [
                { $subtract: ['$deal.originalCost', '$deal.discountPrice'] },
                '$deal.originalCost'
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Enhanced category analysis
    const categoryPreferences = await Commitment.aggregate([
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: 'deals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal'
        }
      },
      {
        $unwind: '$deal'
      },
      {
        $group: {
          _id: '$deal.category',
          count: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] } },
          averageSpent: { $avg: { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] } },
          totalSavings: {
            $sum: {
              $cond: {
                if: { $isArray: '$sizeCommitments' },
                then: {
                  $let: {
                    vars: {
                      effectiveSizeCommitments: {
                        $cond: [
                          { $eq: ['$modifiedByDistributor', true] },
                          { $ifNull: ['$modifiedSizeCommitments', '$sizeCommitments'] },
                          '$sizeCommitments'
                        ]
                      }
                    },
                    in: {
                      $subtract: [
                        {
                          $reduce: {
                            input: '$$effectiveSizeCommitments',
                            initialValue: 0,
                            in: {
                              $add: [
                                '$$value',
                                {
                                  $multiply: [
                                    '$$this.quantity',
                                    {
                                      $let: {
                                        vars: {
                                          matchingSize: {
                                            $arrayElemAt: [
                                              {
                                                $filter: {
                                                  input: '$deal.sizes',
                                                  as: 'size',
                                                  cond: { $eq: ['$$size.size', '$$this.size'] }
                                                }
                                              },
                                              0
                                            ]
                                          }
                                        },
                                        in: { $ifNull: ['$$matchingSize.originalCost', 0] }
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        },
                        { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                      ]
                    }
                  }
                },
                else: {
                  $subtract: [
                    { $multiply: ['$deal.originalCost', { $ifNull: ['$modifiedQuantity', '$quantity'] }] },
                    { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          count: 1,
          totalSpent: 1,
          averageSpent: 1,
          totalSavings: 1,
          savingsPercentage: {
            $multiply: [
              {
                $divide: ['$totalSavings', { $add: ['$totalSpent', '$totalSavings'] }]
              },
              100
            ]
          }
        }
      }
    ]);

    // Simplified savings analysis without complex size calculations
    const savingsAnalysis = await Commitment.aggregate([
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: 'deals',
          localField: 'dealId',
          foreignField: '_id',
          as: 'deal'
        }
      },
      {
        $unwind: '$deal'
      },
      {
        $group: {
          _id: null,
          totalSavings: {
            $sum: {
              $cond: {
                if: { $isArray: '$sizeCommitments' },
                then: {
                  $let: {
                    vars: {
                      effectiveSizeCommitments: {
                        $cond: [
                          { $eq: ['$modifiedByDistributor', true] },
                          { $ifNull: ['$modifiedSizeCommitments', '$sizeCommitments'] },
                          '$sizeCommitments'
                        ]
                      }
                    },
                    in: {
                      $subtract: [
                        {
                          $reduce: {
                            input: '$$effectiveSizeCommitments',
                            initialValue: 0,
                            in: {
                              $add: [
                                '$$value',
                                {
                                  $multiply: [
                                    '$$this.quantity',
                                    {
                                      $let: {
                                        vars: {
                                          matchingSize: {
                                            $arrayElemAt: [
                                              {
                                                $filter: {
                                                  input: '$deal.sizes',
                                                  as: 'size',
                                                  cond: { $eq: ['$$size.size', '$$this.size'] }
                                                }
                                              },
                                              0
                                            ]
                                          }
                                        },
                                        in: { $ifNull: ['$$matchingSize.originalCost', 0] }
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        },
                        { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                      ]
                    }
                  }
                },
                else: {
                  $subtract: [
                    { $multiply: ['$deal.originalCost', { $ifNull: ['$modifiedQuantity', '$quantity'] }] },
                    { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                  ]
                }
              }
            }
          },
          averageSavings: {
            $avg: {
              $cond: {
                if: { $isArray: '$sizeCommitments' },
                then: {
                  $let: {
                    vars: {
                      effectiveSizeCommitments: {
                        $cond: [
                          { $eq: ['$modifiedByDistributor', true] },
                          { $ifNull: ['$modifiedSizeCommitments', '$sizeCommitments'] },
                          '$sizeCommitments'
                        ]
                      }
                    },
                    in: {
                      $subtract: [
                        {
                          $reduce: {
                            input: '$$effectiveSizeCommitments',
                            initialValue: 0,
                            in: {
                              $add: [
                                '$$value',
                                {
                                  $multiply: [
                                    '$$this.quantity',
                                    {
                                      $let: {
                                        vars: {
                                          matchingSize: {
                                            $arrayElemAt: [
                                              {
                                                $filter: {
                                                  input: '$deal.sizes',
                                                  as: 'size',
                                                  cond: { $eq: ['$$size.size', '$$this.size'] }
                                                }
                                              },
                                              0
                                            ]
                                          }
                                        },
                                        in: { $ifNull: ['$$matchingSize.originalCost', 0] }
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        },
                        { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                      ]
                    }
                  }
                },
                else: {
                  $subtract: [
                    { $multiply: ['$deal.originalCost', { $ifNull: ['$modifiedQuantity', '$quantity'] }] },
                    { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                  ]
                }
              }
            }
          },
          maxSavings: {
            $max: {
              $cond: {
                if: { $isArray: '$sizeCommitments' },
                then: {
                  $let: {
                    vars: {
                      effectiveSizeCommitments: {
                        $cond: [
                          { $eq: ['$modifiedByDistributor', true] },
                          { $ifNull: ['$modifiedSizeCommitments', '$sizeCommitments'] },
                          '$sizeCommitments'
                        ]
                      }
                    },
                    in: {
                      $subtract: [
                        {
                          $reduce: {
                            input: '$$effectiveSizeCommitments',
                            initialValue: 0,
                            in: {
                              $add: [
                                '$$value',
                                {
                                  $multiply: [
                                    '$$this.quantity',
                                    {
                                      $let: {
                                        vars: {
                                          matchingSize: {
                                            $arrayElemAt: [
                                              {
                                                $filter: {
                                                  input: '$deal.sizes',
                                                  as: 'size',
                                                  cond: { $eq: ['$$size.size', '$$this.size'] }
                                                }
                                              },
                                              0
                                            ]
                                          }
                                        },
                                        in: { $ifNull: ['$$matchingSize.originalCost', 0] }
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        },
                        { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                      ]
                    }
                  }
                },
                else: {
                  $subtract: [
                    { $multiply: ['$deal.originalCost', { $ifNull: ['$modifiedQuantity', '$quantity'] }] },
                    { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] }
                  ]
                }
              }
            }
          },
          totalTransactions: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ['$modifiedTotalPrice', '$totalPrice'] } }
        }
      },
      {
        $project: {
          _id: 0,
          totalSavings: 1,
          averageSavings: 1,
          maxSavings: 1,
          totalTransactions: 1,
          totalSpent: 1,
          savingsRate: {
            $multiply: [
              {
                $divide: ['$totalSavings', { $add: ['$totalSpent', '$totalSavings'] }]
              },
              100
            ]
          }
        }
      }
    ]);

    // Log the action
    await logCollaboratorAction(req, 'view_detailed_analytics', 'analytics', { 
      timeRange: timeRange,
      startDate: startDate,
      endDate: endDate,
      categories: categories,
      minAmount: minAmount,
      maxAmount: maxAmount,
      searchTerm: searchTerm,
      additionalInfo: `Viewed detailed analytics with time range: ${timeRange}`
    });

    res.json({
      yearlySpending: spendingTrends,
      categoryPreferences,
      savingsAnalysis: savingsAnalysis[0] || {
        totalSavings: 0,
        averageSavings: 0,
        maxSavings: 0,
        totalTransactions: 0,
        totalSpent: 0,
        savingsRate: 0
      }
    });
  } catch (error) {
    console.error('Error fetching detailed analytics:', error);
    await logError(req, 'view_detailed_analytics', 'analytics', error, {
      timeRange: req.query.timeRange,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    res.status(500).json({ message: 'Error fetching detailed analytics' });
  }
});


// Legacy route for backward compatibility
router.put('/commitments/:commitmentId/modify', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const { quantity } = req.body;
    const commitment = await Commitment.findById(req.params.commitmentId).populate('dealId');

    if (!commitment) {
      return res.status(404).json({ message: 'Commitment not found' });
    }

    if (commitment.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending commitments can be modified' });
    }

    // Check if commitment period has ended
    if (commitment.dealId.commitmentEndsAt) {
      const commitmentEndDate = new Date(commitment.dealId.commitmentEndsAt);
      const now = new Date();
      if (now > commitmentEndDate) {
        return res.status(400).json({
          error: "Commitment period ended",
          message: `The commitment period for this deal ended on ${commitmentEndDate.toLocaleDateString()}. You can no longer modify commitments to this deal.`
        });
      }
    }

    // Check if commitment period has started (optional validation)
    if (commitment.dealId.commitmentStartAt) {
      const commitmentStartDate = new Date(commitment.dealId.commitmentStartAt);
      const now = new Date();
      if (now < commitmentStartDate) {
        return res.status(400).json({
          error: "Commitment period not started",
          message: `The commitment period for this deal starts on ${commitmentStartDate.toLocaleDateString()}. You can modify commitments during the active period.`
        });
      }
    }

    // For backward compatibility with older clients
    res.status(400).json({ 
      message: 'This API is deprecated. Please use /modify-sizes endpoint for size-specific modifications.' 
    });
  } catch (error) {
    console.error('Error modifying commitment quantity:', error);
    res.status(500).json({ message: 'Error modifying commitment quantity' });
  }
});

// New route to modify commitment sizes
router.put('/commitments/:commitmentId/modify-sizes', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const { sizeCommitments } = req.body;
    
    if (!sizeCommitments || !Array.isArray(sizeCommitments)) {
      return res.status(400).json({ message: 'Size commitments are required and must be an array' });
    }

    // Filter out sizes with 0 quantity
    const nonZeroSizes = sizeCommitments.filter(size => size.quantity > 0);
    
    // Validate each non-zero size commitment
    for (const size of nonZeroSizes) {
      if (!size.size || !size.pricePerUnit) {
        return res.status(400).json({ message: 'Each size must have a size and price per unit' });
      }
    }

    const commitment = await Commitment.findById(req.params.commitmentId).populate('dealId');

    if (!commitment) {
      return res.status(404).json({ message: 'Commitment not found' });
    }

    if (commitment.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending commitments can be modified' });
    }

    // Check if commitment period has ended
    if (commitment.dealId.commitmentEndsAt) {
      const commitmentEndDate = new Date(commitment.dealId.commitmentEndsAt);
      const now = new Date();
      if (now > commitmentEndDate) {
        return res.status(400).json({
          error: "Commitment period ended",
          message: `The commitment period for this deal ended on ${commitmentEndDate.toLocaleDateString()}. You can no longer modify commitments to this deal.`
        });
      }
    }

    // Check if commitment period has started (optional validation)
    if (commitment.dealId.commitmentStartAt) {
      const commitmentStartDate = new Date(commitment.dealId.commitmentStartAt);
      const now = new Date();
      if (now < commitmentStartDate) {
        return res.status(400).json({
          error: "Commitment period not started",
          message: `The commitment period for this deal starts on ${commitmentStartDate.toLocaleDateString()}. You can modify commitments during the active period.`
        });
      }
    }

    // If all sizes are 0, cancel the commitment instead of updating
    if (nonZeroSizes.length === 0) {
      commitment.status = 'cancelled';
      await commitment.save();
      
      await logCollaboratorAction(req, 'cancel_commitment_via_modification', 'commitment', { 
        commitmentId: commitment._id,
        dealName: commitment.dealId.name,
        resourceId: commitment._id,
        dealId: commitment.dealId._id
      });
      
      return res.json({
        message: 'All sizes set to 0. Commitment has been cancelled.',
        commitment,
        cancelled: true
      });
    }

    // Verify all non-zero sizes exist in the deal
    for (const sizeCommit of nonZeroSizes) {
      const matchingDealSize = commitment.dealId.sizes.find(s => s.size === sizeCommit.size);
      if (!matchingDealSize) {
        return res.status(400).json({
          message: `Size "${sizeCommit.size}" does not exist in this deal`
        });
      }
    }

    // Calculate total price
    const totalPrice = nonZeroSizes.reduce((sum, size) => {
      return sum + (size.quantity * size.pricePerUnit);
    }, 0);

    // Check if discount tier should be applied
    const totalQuantity = nonZeroSizes.reduce((sum, size) => sum + size.quantity, 0);
    
    let appliedDiscountTier = null;
    if (commitment.dealId.discountTiers && commitment.dealId.discountTiers.length > 0) {
      // Sort tiers by quantity in descending order to find highest applicable tier
      const sortedTiers = [...commitment.dealId.discountTiers].sort((a, b) => b.tierQuantity - a.tierQuantity);
      
      // Find highest applicable tier
      for (const tier of sortedTiers) {
        if (totalQuantity >= tier.tierQuantity) {
          appliedDiscountTier = tier;
          break;
        }
      }
    }

    // Calculate final price with discount if applicable
    let finalPrice = totalPrice;
    
    if (appliedDiscountTier) {
      const discountRate = appliedDiscountTier.tierDiscount / 100;
      finalPrice = totalPrice * (1 - discountRate);
      
      // Apply discount to each size
      for (const size of nonZeroSizes) {
        size.pricePerUnit = size.pricePerUnit * (1 - discountRate);
        size.totalPrice = size.quantity * size.pricePerUnit;
      }
    } else {
      // Calculate total price for each size
      for (const size of nonZeroSizes) {
        size.totalPrice = size.quantity * size.pricePerUnit;
      }
    }

    // Count how many sizes were removed (had 0 quantity)
    const removedSizesCount = sizeCommitments.length - nonZeroSizes.length;

    // Update commitment with only non-zero sizes
    commitment.sizeCommitments = nonZeroSizes;
    commitment.totalPrice = finalPrice;
    commitment.appliedDiscountTier = appliedDiscountTier;
    
    await commitment.save();

    // Log the action
    await logCollaboratorAction(req, 'modify_commitment_sizes', 'commitment', { 
      commitmentId: commitment._id,
      sizesCount: nonZeroSizes.length,
      removedSizesCount: removedSizesCount,
      totalQuantity: totalQuantity,
      finalPrice: finalPrice,
      appliedDiscountTier: appliedDiscountTier,
      additionalInfo: `Modified commitment sizes: ${nonZeroSizes.length} sizes, ${totalQuantity} units, $${finalPrice.toFixed(2)}${removedSizesCount > 0 ? `, removed ${removedSizesCount} size(s) with 0 quantity` : ''}`
    });

    res.json({
      message: 'Commitment modified successfully',
      commitment
    });
  } catch (error) {
    console.error('Error modifying commitment:', error);
    await logError(req, 'modify_commitment_sizes', 'commitment', error, {
      commitmentId: req.params.commitmentId
    });
    res.status(500).json({ message: 'Error modifying commitment' });
  }
});

// Get member dashboard access
router.get('/dashboard-access', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    // Get user data
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get basic stats for dashboard
    const totalCommitments = await Commitment.countDocuments({ userId });
    const activeCommitments = await Commitment.countDocuments({
      userId,
      status: 'pending'
    });
    
    // Get total spent
    const commitments = await Commitment.find({
      userId,
      status: 'approved',
      paymentStatus: 'paid'
    });
    const totalSpent = commitments.reduce((sum, commitment) => 
      sum + (commitment.modifiedTotalPrice || commitment.totalPrice), 0);
    
    // Get favorite deals count
    const favoriteDeals = await Favorite.countDocuments({ userId });
    
    // Log the action
    await logCollaboratorAction(req, 'access_member_dashboard', 'dashboard', { 
      userId: userId,
      userName: user.name,
      userEmail: user.email,
      totalCommitments: totalCommitments,
      activeCommitments: activeCommitments,
      totalSpent: totalSpent,
      favoriteDeals: favoriteDeals,
      additionalInfo: `Accessed member dashboard: ${user.name}`
    });
    
    res.json({
      user,
      dashboardStats: {
        totalCommitments,
        activeCommitments,
        totalSpent,
        favoriteDeals
      },
      isImpersonating
    });
  } catch (error) {
    console.error('Error fetching member dashboard access:', error);
    await logError(req, 'access_member_dashboard', 'dashboard', error);
    res.status(500).json({ message: 'Error fetching member dashboard access' });
  }
});

// Get all deals with commitments comparison for member report
router.get('/deals-report', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;
    
    const { startDate, endDate } = req.query;
    
    // Build base query
    let query = { status: 'active' };
    
    // Build date filter if date range is provided
    // Filter deals by their commitment period dates that overlap with the selected date range
    if (startDate || endDate) {
      const dateConditions = [];
      
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        
        // Find deals whose commitment period overlaps with the date range
        dateConditions.push({
          $or: [
            {
              $and: [
                { commitmentStartAt: { $exists: true } },
                { commitmentStartAt: { $lte: endDateObj } },
                { commitmentEndsAt: { $gte: startDateObj } }
              ]
            },
            {
              $and: [
                { commitmentStartAt: { $exists: false } },
                { dealStartAt: { $exists: true } },
                { dealStartAt: { $lte: endDateObj } },
                { dealEndsAt: { $gte: startDateObj } }
              ]
            }
          ]
        });
      } else if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        
        dateConditions.push({
          $or: [
            {
              $and: [
                { commitmentStartAt: { $exists: true } },
                { commitmentEndsAt: { $gte: startDateObj } }
              ]
            },
            {
              $and: [
                { commitmentStartAt: { $exists: false } },
                { dealStartAt: { $exists: true } },
                { dealEndsAt: { $gte: startDateObj } }
              ]
            }
          ]
        });
      } else if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        
        dateConditions.push({
          $or: [
            {
              $and: [
                { commitmentStartAt: { $exists: true } },
                { commitmentStartAt: { $lte: endDateObj } }
              ]
            },
            {
              $and: [
                { commitmentStartAt: { $exists: false } },
                { dealStartAt: { $exists: true } },
                { dealStartAt: { $lte: endDateObj } }
              ]
            }
          ]
        });
      }
      
      if (dateConditions.length > 0) {
        query = { ...query, ...dateConditions[0] };
      }
    }
    
    // Fetch all deals matching the criteria
    const deals = await Deal.find(query)
      .populate('distributor', 'businessName name email')
      .sort({ name: 1 })
      .lean();
    
    // Fetch all commitments for this member
    const commitments = await Commitment.find({ userId })
      .populate('dealId', 'name')
      .lean();
    
    // Create a map of dealId -> commitment for quick lookup
    const commitmentMap = {};
    commitments.forEach(commitment => {
      const dealId = commitment.dealId?._id?.toString();
      if (dealId) {
        if (!commitmentMap[dealId]) {
          commitmentMap[dealId] = [];
        }
        commitmentMap[dealId].push(commitment);
      }
    });
    
    // Process deals and add commitment information
    const dealsWithCommitments = deals.map(deal => {
      const dealId = deal._id.toString();
      const dealCommitments = commitmentMap[dealId] || [];
      
      // Determine commitment status
      let commitmentStatus = 'No Commitment';
      let commitmentDetails = null;
      
      if (dealCommitments.length > 0) {
        // Find the most recent commitment
        const latestCommitment = dealCommitments.reduce((latest, curr) => {
          return new Date(curr.createdAt) > new Date(latest.createdAt) ? curr : latest;
        });
        
        commitmentStatus = latestCommitment.status.charAt(0).toUpperCase() + latestCommitment.status.slice(1);
        commitmentDetails = {
          status: latestCommitment.status,
          totalQuantity: latestCommitment.modifiedByDistributor && latestCommitment.modifiedSizeCommitments
            ? latestCommitment.modifiedSizeCommitments.reduce((sum, size) => sum + (size.quantity || 0), 0)
            : latestCommitment.sizeCommitments.reduce((sum, size) => sum + (size.quantity || 0), 0),
          totalPrice: latestCommitment.modifiedTotalPrice || latestCommitment.totalPrice,
          createdAt: latestCommitment.createdAt,
          distributorResponse: latestCommitment.distributorResponse || null
        };
      }
      
      // Determine which month this deal's commitment period falls into
      let commitmentMonth = null;
      if (deal.commitmentStartAt && deal.commitmentEndsAt) {
        const startDate = new Date(deal.commitmentStartAt);
        const endDate = new Date(deal.commitmentEndsAt);
        const monthIndex = startDate.getMonth();
        const year = startDate.getFullYear();
        commitmentMonth = `${MONTHS[monthIndex]} ${year}`;
      }
      
      return {
        ...deal,
        commitmentStatus,
        commitmentDetails,
        commitmentMonth,
        hasCommitment: dealCommitments.length > 0
      };
    });
    
    // Log the action
    await logCollaboratorAction(req, 'view_deals_report', 'report', { 
      userId: userId,
      startDate: startDate || null,
      endDate: endDate || null,
      totalDeals: dealsWithCommitments.length,
      dealsWithCommitments: dealsWithCommitments.filter(d => d.hasCommitment).length,
      additionalInfo: `Viewed deals report: ${dealsWithCommitments.length} deals, ${dealsWithCommitments.filter(d => d.hasCommitment).length} with commitments`
    });
    
    res.json({
      deals: dealsWithCommitments,
      startDate: startDate || null,
      endDate: endDate || null,
      totalDeals: dealsWithCommitments.length,
      dealsWithCommitments: dealsWithCommitments.filter(d => d.hasCommitment).length,
      dealsWithoutCommitments: dealsWithCommitments.filter(d => !d.hasCommitment).length
    });
  } catch (error) {
    console.error('Error fetching deals report:', error);
    await logError(req, 'view_deals_report', 'report', error);
    res.status(500).json({ message: 'Error fetching deals report' });
  }
});

// Get approved deals report for a specific month
router.get('/approved-deals-report', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const userId = currentUser.id;

    const { month, distributorId, allMonths } = req.query;

    // Parse month and calculate date range (only if not all months)
    let monthName, year, rangeStart, rangeEnd;

    if (allMonths === 'true') {
      // For all months, don't require month parameter and don't calculate date range
      console.log('=== ALL MONTHS MODE - No date filtering ===');
    } else {
      if (!month) {
        return res.status(400).json({ message: 'Month parameter is required' });
      }

      // Parse month value (format: "Month Year", e.g., "October 2025")
      // This is the actual month (previous month of display month)
      const monthParts = month.trim().split(' ');
      if (monthParts.length !== 2) {
        return res.status(400).json({ message: 'Invalid month format. Expected "Month Year"' });
      }

      monthName = monthParts[0];
      year = parseInt(monthParts[1], 10);

      if (isNaN(year) || !MONTHS.includes(monthName)) {
        return res.status(400).json({ message: 'Invalid month or year' });
      }

      // Calculate date range: 5th to 25th of the month
      const monthIndex = MONTHS.indexOf(monthName);
      rangeStart = new Date(year, monthIndex, 5, 0, 0, 0, 0);
      rangeEnd = new Date(year, monthIndex, 25, 23, 59, 59, 999);

      console.log('=== DATE RANGE CALCULATION ===');
      console.log('Month:', monthName, 'Year:', year, 'Index:', monthIndex);
      console.log('Range Start:', rangeStart.toISOString());
      console.log('Range End:', rangeEnd.toISOString());
    }

    // Find ALL deals whose deal dates overlap with 5th-25th (or all deals if allMonths is true)
    // Use dealStartAt and dealEndsAt (not commitment dates)
    // Don't filter by status - include both active and inactive deals
    let dealQuery = {};

    if (allMonths !== 'true') {
      // Apply date filtering only when not in all months mode
      dealQuery.dealStartAt = { $lte: rangeEnd };
      dealQuery.dealEndsAt = { $gte: rangeStart };
    }

    // Filter by distributor if provided
    if (distributorId) {
      dealQuery.distributor = distributorId;
    }

    // Fetch all deals matching the date range
    const deals = await Deal.find(dealQuery)
      .populate('distributor', 'businessName name email')
      .sort({ 'distributor.businessName': 1, name: 1 })
      .lean();
  

    // Get ALL commitments for these deals (not just approved ones)
    const dealIds = deals.map(d => d._id);

    const allCommitments = await Commitment.find({
      dealId: { $in: dealIds }
    }).lean();

    // Create maps for commitments
    const dealAllCommitmentsMap = {};
    const dealApprovedCommitmentsMap = {};
    const dealDeclinedCommitmentsMap = {};

    allCommitments.forEach(commitment => {
      const dealId = commitment.dealId.toString();
      if (!dealAllCommitmentsMap[dealId]) {
        dealAllCommitmentsMap[dealId] = [];
      }
      if (!dealApprovedCommitmentsMap[dealId]) {
        dealApprovedCommitmentsMap[dealId] = [];
      }
      if (!dealDeclinedCommitmentsMap[dealId]) {
        dealDeclinedCommitmentsMap[dealId] = [];
      }

      dealAllCommitmentsMap[dealId].push(commitment);

      if (commitment.status === 'approved') {
        dealApprovedCommitmentsMap[dealId].push(commitment);
      } else if (commitment.status === 'declined' || commitment.status === 'cancelled') {
        dealDeclinedCommitmentsMap[dealId].push(commitment);
      }
    });

    // Get user's commitments for these deals
    const userCommitments = await Commitment.find({
      userId,
      dealId: { $in: dealIds }
    }).lean();

    // Create a map of dealId -> user's commitment
    const userCommitmentMap = {};
    userCommitments.forEach(commitment => {
      const dealId = commitment.dealId.toString();
      userCommitmentMap[dealId] = commitment;
    });

    // Process ALL deals that fall within the date range
    const approvedDeals = [];
    const declinedDeals = [];
    const pendingDeals = [];

    for (const deal of deals) {
      const dealId = deal._id.toString();
      const allCommitmentsForDeal = dealAllCommitmentsMap[dealId] || [];
      const approvedCommitmentsForDeal = dealApprovedCommitmentsMap[dealId] || [];
      const declinedCommitmentsForDeal = dealDeclinedCommitmentsMap[dealId] || [];

      // Determine deal status with majority rule for mixed cases
      let dealStatus = 'pending';
      let statusReason = 'no_commitments';

      if (deal.bulkAction && deal.bulkStatus === 'approved') {
        dealStatus = 'approved';
        statusReason = 'bulk_approved';
      } else if (deal.bulkAction && deal.bulkStatus === 'rejected') {
        dealStatus = 'declined';
        statusReason = 'bulk_declined';
      } else if (allCommitmentsForDeal.length > 0) {
        // Check if all commitments are approved
        if (approvedCommitmentsForDeal.length === allCommitmentsForDeal.length) {
          dealStatus = 'approved';
          statusReason = 'all_approved';
        } else if (declinedCommitmentsForDeal.length === allCommitmentsForDeal.length) {
          dealStatus = 'declined';
          statusReason = 'all_declined';
        } else {
          // Mixed case - majority wins
          if (approvedCommitmentsForDeal.length > declinedCommitmentsForDeal.length) {
            dealStatus = 'approved';
            statusReason = 'majority_approved';
          } else if (declinedCommitmentsForDeal.length > approvedCommitmentsForDeal.length) {
            dealStatus = 'declined';
            statusReason = 'majority_declined';
          } else {
            // Equal number - consider pending
            dealStatus = 'pending';
            statusReason = 'equal_split';
          }
        }
      }

      // Get user's commitment for this deal (if any)
      const userCommitment = userCommitmentMap[dealId];

      // Process each size in the deal
      const dealSizes = deal.sizes || [];

      for (const size of dealSizes) {
        // Calculate bottle price (discountPrice / bottlesPerCase)
        const bottlesPerCase = size.bottlesPerCase || 1;
        const bottlePrice = size.discountPrice / bottlesPerCase;

        // Get user's commitment quantity for this size (if any)
        let userCommitmentQuantity = 0;
        if (userCommitment) {
          const sizeCommitments = userCommitment.modifiedByDistributor && userCommitment.modifiedSizeCommitments
            ? userCommitment.modifiedSizeCommitments
            : userCommitment.sizeCommitments || [];

          const userSizeCommitment = sizeCommitments.find(sc => sc.size === size.size);
          if (userSizeCommitment) {
            userCommitmentQuantity = userSizeCommitment.quantity || 0;
          }
        }

        const dealData = {
          dealId: deal._id,
          dealName: deal.name,
          category: deal.category,
          distributor: {
            id: deal.distributor._id,
            name: deal.distributor.businessName || deal.distributor.name,
            email: deal.distributor.email
          },
          size: size.size,
          sizeName: size.name || size.size,
          bottlePrice: parseFloat(bottlePrice.toFixed(2)),
          casePrice: size.discountPrice,
          bottlesPerCase: bottlesPerCase,
          originalBottlePrice: size.originalCost / bottlesPerCase,
          userCommitmentQuantity: userCommitmentQuantity,
          hasUserCommitment: userCommitmentQuantity > 0,
          dealStatus: dealStatus,
          statusReason: statusReason,
          totalCommitments: allCommitmentsForDeal.length,
          approvedCommitments: approvedCommitmentsForDeal.length,
          declinedCommitments: declinedCommitmentsForDeal.length
        };

        // Add to appropriate category
        if (dealStatus === 'approved') {
          approvedDeals.push(dealData);
        } else if (dealStatus === 'declined') {
          declinedDeals.push(dealData);
        } else {
          pendingDeals.push(dealData);
        }
      }
    }

    // Helper function to group deals by distributor
    const groupDealsByDistributor = (deals) => {
      const grouped = {};
      deals.forEach(deal => {
        const distributorId = deal.distributor.id.toString();
        if (!grouped[distributorId]) {
          grouped[distributorId] = {
            distributor: deal.distributor,
            deals: []
          };
        }
        grouped[distributorId].deals.push(deal);
      });

      // Convert to array and sort
      const distributorGroups = Object.values(grouped).map(group => ({
        distributor: group.distributor,
        deals: group.deals.sort((a, b) => {
          // Sort by deal name, then by size name
          if (a.dealName !== b.dealName) {
            return a.dealName.localeCompare(b.dealName);
          }
          return (a.sizeName || a.size).localeCompare(b.sizeName || b.size);
        })
      }));

      // Sort distributor groups by distributor name
      distributorGroups.sort((a, b) =>
        a.distributor.name.localeCompare(b.distributor.name)
      );

      return distributorGroups;
    };

    // Group each category by distributor
    const approvedDistributorGroups = groupDealsByDistributor(approvedDeals);
    const declinedDistributorGroups = groupDealsByDistributor(declinedDeals);
    const pendingDistributorGroups = groupDealsByDistributor(pendingDeals);

    console.log('=== FINAL RESULT ===');
    console.log('Approved deals:', approvedDeals.length);
    console.log('Declined deals:', declinedDeals.length);
    console.log('Pending deals:', pendingDeals.length);
    console.log('Approved distributors:', approvedDistributorGroups.length);
    console.log('Declined distributors:', declinedDistributorGroups.length);
    console.log('Pending distributors:', pendingDistributorGroups.length);

    if (approvedDeals.length > 0) {
      console.log('Sample approved deals:');
      approvedDeals.slice(0, 2).forEach((deal, index) => {
        console.log(`${index + 1}. ${deal.dealName} (${deal.sizeName || deal.size}) - $${deal.bottlePrice} - Status: ${deal.dealStatus} (${deal.statusReason})`);
      });
    }

    // Log the action
    await logCollaboratorAction(req, 'view_approved_deals_report', 'report', {
      userId: userId,
      month: month,
      distributorId: distributorId || 'all',
      approvedDeals: approvedDeals.length,
      declinedDeals: declinedDeals.length,
      pendingDeals: pendingDeals.length,
      additionalInfo: `Viewed approved deals report for ${month}: ${approvedDeals.length} approved, ${declinedDeals.length} declined, ${pendingDeals.length} pending`
    });

    res.json({
      month: allMonths === 'true' ? 'all_months' : month,
      monthName: allMonths === 'true' ? 'All Months' : monthName,
      year: allMonths === 'true' ? null : year,
      dateRange: allMonths === 'true' ? null : {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString()
      },
      approvedDeals: {
        distributorGroups: approvedDistributorGroups,
        totalDeals: approvedDeals.length,
        totalDistributors: approvedDistributorGroups.length
      },
      declinedDeals: {
        distributorGroups: declinedDistributorGroups,
        totalDeals: declinedDeals.length,
        totalDistributors: declinedDistributorGroups.length
      },
      pendingDeals: {
        distributorGroups: pendingDistributorGroups,
        totalDeals: pendingDeals.length,
        totalDistributors: pendingDistributorGroups.length
      }
    });
  } catch (error) {
    console.error('Error fetching approved deals report:', error);
    await logError(req, 'view_approved_deals_report', 'report', error);
    res.status(500).json({ message: 'Error fetching approved deals report' });
  }
});

module.exports = router;
