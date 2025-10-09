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
    
    const commitments = await Commitment.find({ userId })
      .sort({ createdAt: -1 })
      .populate('dealId', 'name category')
      .populate('userId', 'name');
    
    // Log the action
    await logCollaboratorAction(req, 'view_member_commitments', 'commitments', { 
      totalCommitments: commitments.length,
      additionalInfo: `Viewed ${commitments.length} member commitments`
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

module.exports = router;
