const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

router.get('/',isAdmin, async (req, res) => {
  try {
    const deals = await Deal.aggregate([
     
      {
        $lookup: {
          from: 'users',
          localField: 'distributor',
          foreignField: '_id',
          as: 'distributorInfo'
        }
      },
      {
        $lookup: {
          from: 'commitments',
          localField: '_id',
          foreignField: 'dealId',
          as: 'commitmentDetails'
        }
      },
      {
        $addFields: {
          distributor: {
            $cond: {
              if: { $gt: [{ $size: '$distributorInfo' }, 0] },
              then: {
                $let: {
                  vars: {
                    distributorDoc: { $arrayElemAt: ['$distributorInfo', 0] }
                  },
                  in: {
                    _id: '$$distributorDoc._id',
                    businessName: '$$distributorDoc.businessName',
                    logo: '$$distributorDoc.logo',
                    email: '$$distributorDoc.email',
                    phone: '$$distributorDoc.phone',
                    contactPerson: '$$distributorDoc.contactPerson',
                    name: '$$distributorDoc.name'
                  }
                }
              },
              else: null
            }
          },
          totalCommitments: { $size: { $ifNull: ['$commitments', []] } },
          totalCommittedQuantity: { 
            $reduce: {
              input: '$commitmentDetails',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: {
                      if: { $isArray: '$$this.sizeCommitments' },
                      then: {
                        $reduce: {
                          input: '$$this.sizeCommitments',
                          initialValue: 0,
                          in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] }
                        }
                      },
                      else: { $ifNull: ['$$this.quantity', 0] }
                    }
                  }
                ]
              }
            }
          },
          // Calculate average prices across all sizes (use default value for older data format)
          avgOriginalCost: { 
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.originalCost' } } },
              else: { $ifNull: ['$originalCost', 0] } // For backward compatibility
            }
          },
          avgDiscountPrice: { 
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.discountPrice' } } },
              else: { $ifNull: ['$discountPrice', 0] } // For backward compatibility
            }
          },
          // Add min and max price range for each deal
          minOriginalCost: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $min: { $map: { input: '$sizes', as: 'size', in: '$$size.originalCost' } } },
              else: { $ifNull: ['$originalCost', 0] }
            }
          },
          maxOriginalCost: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $max: { $map: { input: '$sizes', as: 'size', in: '$$size.originalCost' } } },
              else: { $ifNull: ['$originalCost', 0] }
            }
          },
          minDiscountPrice: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $min: { $map: { input: '$sizes', as: 'size', in: '$$size.discountPrice' } } },
              else: { $ifNull: ['$discountPrice', 0] }
            }
          },
          maxDiscountPrice: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $max: { $map: { input: '$sizes', as: 'size', in: '$$size.discountPrice' } } },
              else: { $ifNull: ['$discountPrice', 0] }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          bulkAction: 1,
          bulkStatus: 1,
          sizes: 1,
          originalCost: 1, // Keep for backward compatibility
          discountPrice: 1, // Keep for backward compatibility
          avgOriginalCost: 1,
          avgDiscountPrice: 1,
          minOriginalCost: 1,
          maxOriginalCost: 1,
          minDiscountPrice: 1,
          maxDiscountPrice: 1,
          category: 1,
          status: 1,
          dealStartAt: 1,
          dealEndsAt: 1,
          commitmentStartAt: 1,
          commitmentEndsAt: 1,
          minQtyForDiscount: 1,
          discountTiers: 1,
          singleStoreDeals: 1,
          images: 1,
          totalSold: 1,
          totalRevenue: 1,
          views: 1,
          impressions: 1,
          distributor: 1,
          totalCommitments: 1,
          totalCommittedQuantity: 1
        }
      }
    ]);
    
    // Calculate additional fields that can't be done in aggregation
    const dealsWithSavings = deals.map(deal => {
      const avgSavingsPerUnit = deal.avgOriginalCost - deal.avgDiscountPrice;
      const avgSavingsPercentage = ((avgSavingsPerUnit / deal.avgOriginalCost) * 100).toFixed(2);
      
      // For backward compatibility, ensure sizes array exists
      if (!deal.sizes || deal.sizes.length === 0) {
        deal.sizes = [{
          size: 'Standard',
          originalCost: deal.originalCost || deal.avgOriginalCost,
          discountPrice: deal.discountPrice || deal.avgDiscountPrice
        }];
      }
      
      // Add maximum possible savings percentage
      const maxSavingsPercentage = deal.sizes.reduce((max, size) => {
        const savingsPercent = ((size.originalCost - size.discountPrice) / size.originalCost) * 100;
        return savingsPercent > max ? savingsPercent : max;
      }, 0).toFixed(2);
      
      return {
        ...deal,
        avgSavingsPerUnit,
        avgSavingsPercentage,
        maxSavingsPercentage,
        totalPotentialSavings: avgSavingsPerUnit * deal.minQtyForDiscount,
        remainingQuantity: Math.max(0, deal.minQtyForDiscount - (deal.totalCommittedQuantity || 0))
      };
    });
    
    await logCollaboratorAction(req, 'view_admin_all_deals', 'deals', { 
      totalDeals: dealsWithSavings.length,
      additionalInfo: 'Admin viewed all deals with analytics data'
    });
    res.json(dealsWithSavings);
  } catch (error) {
    console.error('Error in fetchAllDeals:', error);
    await logCollaboratorAction(req, 'view_admin_all_deals_failed', 'deals', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

router.get('/buy', isAuthenticated, async (req, res) => {
  try {
    // Extract query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 24;
    const skip = page * limit;
    
    // Extract filter parameters
    const { 
      searchQuery = '', 
      category = '', 
      distributor = '',
      minPrice,
      maxPrice,
      favoritesOnly,
      committedOnly 
    } = req.query;

    // Build match criteria
    const matchCriteria = {
      status: 'active',
      dealStartAt: { $lte: new Date() },
      dealEndsAt: { $gte: new Date() }
    };

    // Add search query filter
    if (searchQuery) {
      matchCriteria.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // Add category filter
    if (category) {
      matchCriteria.category = category;
    }

    // Add price range filter to match criteria
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) {
        priceFilter.$gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        priceFilter.$lte = parseFloat(maxPrice);
      }
      // Match deals where at least one size falls within the price range
      matchCriteria['sizes.discountPrice'] = priceFilter;
    }

    const deals = await Deal.aggregate([
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'users',
          localField: 'distributor',
          foreignField: '_id',
          as: 'distributorInfo'
        }
      },
      {
        $lookup: {
          from: 'commitments',
          localField: '_id',
          foreignField: 'dealId',
          as: 'commitmentDetails'
        }
      },
      {
        $addFields: {
          distributor: {
            $cond: {
              if: { $gt: [{ $size: '$distributorInfo' }, 0] },
              then: {
                $let: {
                  vars: {
                    distributorDoc: { $arrayElemAt: ['$distributorInfo', 0] }
                  },
                  in: {
                    _id: '$$distributorDoc._id',
                    businessName: '$$distributorDoc.businessName',
                    logo: '$$distributorDoc.logo',
                    email: '$$distributorDoc.email',
                    phone: '$$distributorDoc.phone',
                    contactPerson: '$$distributorDoc.contactPerson',
                    name: '$$distributorDoc.name'
                  }
                }
              },
              else: null
            }
          },
          totalCommitments: { $size: { $ifNull: ['$commitments', []] } },
          totalCommittedQuantity: { 
            $reduce: {
              input: '$commitmentDetails',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  {
                    $cond: {
                      if: { $isArray: '$$this.sizeCommitments' },
                      then: {
                        $reduce: {
                          input: '$$this.sizeCommitments',
                          initialValue: 0,
                          in: { $add: ['$$value', { $ifNull: ['$$this.quantity', 0] }] }
                        }
                      },
                      else: { $ifNull: ['$$this.quantity', 0] }
                    }
                  }
                ]
              }
            }
          },
          // Calculate average prices across all sizes (use default value for older data format)
          avgOriginalCost: { 
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.originalCost' } } },
              else: { $ifNull: ['$originalCost', 0] } // For backward compatibility
            }
          },
          avgDiscountPrice: { 
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
              then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.discountPrice' } } },
              else: { $ifNull: ['$discountPrice', 0] } // For backward compatibility
            }
          }
        }
      },
      // Add distributor filter after population
      ...(distributor ? [{
        $match: {
          'distributor.businessName': distributor
        }
      }] : []),
      // Count total before pagination
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                description: 1,
                sizes: 1,
                originalCost: 1,
                discountPrice: 1,
                avgOriginalCost: 1,
                avgDiscountPrice: 1,
                category: 1,
                status: 1,
                dealStartAt: 1,
                dealEndsAt: 1,
                commitmentStartAt: 1,
                commitmentEndsAt: 1,
                minQtyForDiscount: 1,
                discountTiers: 1,
                singleStoreDeals: 1,
                images: 1,
                totalSold: 1,
                totalRevenue: 1,
                views: 1,
                impressions: 1,
                distributor: 1,
                totalCommitments: 1,
                totalCommittedQuantity: 1
              }
            }
          ]
        }
      }
    ]);

    // Extract results from facet
    const totalDeals = deals[0]?.metadata[0]?.total || 0;
    const paginatedDeals = deals[0]?.data || [];
    
    // Update impressions in bulk (only for the deals on this page)
    await Promise.all(
      paginatedDeals.map(deal => 
        Deal.findByIdAndUpdate(deal._id, { $inc: { impressions: 1 } })
      )
    );

    // Calculate additional fields
    const dealsWithSavings = paginatedDeals.map(deal => {
      const avgSavingsPerUnit = deal.avgOriginalCost - deal.avgDiscountPrice;
      const avgSavingsPercentage = ((avgSavingsPerUnit / deal.avgOriginalCost) * 100).toFixed(2);
      
      // For backward compatibility, ensure sizes array exists
      if (!deal.sizes || deal.sizes.length === 0) {
        deal.sizes = [{
          size: 'Standard',
          originalCost: deal.originalCost || deal.avgOriginalCost,
          discountPrice: deal.discountPrice || deal.avgDiscountPrice
        }];
      }
      
      return {
        ...deal,
        avgSavingsPerUnit,
        avgSavingsPercentage,
        totalPotentialSavings: avgSavingsPerUnit * deal.minQtyForDiscount,
        remainingQuantity: Math.max(0, deal.minQtyForDiscount - (deal.totalCommittedQuantity || 0))
      };
    });

    // Get all unique categories and distributors for filters
    const allCategories = await Deal.distinct('category', { 
      status: 'active',
      dealStartAt: { $lte: new Date() },
      dealEndsAt: { $gte: new Date() }
    });
    
    const allDistributors = await Deal.aggregate([
      { 
        $match: { 
          status: 'active',
          dealStartAt: { $lte: new Date() },
          dealEndsAt: { $gte: new Date() }
        } 
      },
      {
        $lookup: {
          from: 'users',
          localField: 'distributor',
          foreignField: '_id',
          as: 'distributorInfo'
        }
      },
      {
        $unwind: '$distributorInfo'
      },
      {
        $group: {
          _id: '$distributorInfo.businessName'
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const distributorNames = allDistributors.map(d => d._id).filter(name => name);

    await logCollaboratorAction(req, 'view_available_deals', 'deals', { 
      totalDeals: totalDeals,
      page: page,
      limit: limit,
      additionalInfo: 'User viewed available deals for purchase with pagination'
    });

    res.json({
      deals: dealsWithSavings,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDeals / limit),
        totalDeals: totalDeals,
        dealsPerPage: limit
      },
      filters: {
        categories: allCategories,
        distributors: distributorNames
      }
    });
  } catch (error) {
    console.error('Error in fetchAllDeals/buy:', error);
    await logCollaboratorAction(req, 'view_available_deals_failed', 'deals', { 
      additionalInfo: `Error: ${error.message}`
    });
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

module.exports = router;
