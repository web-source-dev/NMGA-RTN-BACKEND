const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const { isAuthenticated, isAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const { convertArrayToCSV } = require('convert-array-to-csv');
const PDFDocument = require('pdfkit');

const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleDateString('en-US');
  } catch (err) {
    return 'N/A';
  }
};

const formatDateRange = (start, end) => {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel === 'N/A' && endLabel === 'N/A') return 'N/A';
  return `${startLabel} - ${endLabel}`;
};

const formatCurrencyValue = (value) => {
  if (typeof value !== 'number') return '';
  return value.toFixed(2);
};

const buildDiscountTierLabel = (discountTiers = []) => {
  if (!Array.isArray(discountTiers) || discountTiers.length === 0) return '';
  return discountTiers
    .filter((tier) => tier && tier.tierQuantity != null && tier.tierDiscount != null)
    .map((tier) => `${tier.tierQuantity}+ @ $${formatCurrencyValue(tier.tierDiscount)}`)
    .join(' | ');
};

const getMonthBounds = (monthParam) => {
  if (!monthParam) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startOfMonth, endOfMonth };
  }

  const parts = monthParam.split('-');
  if (parts.length !== 2) {
    throw new Error('Invalid month format. Use YYYY-MM.');
  }

  const [yearStr, monthStr] = parts;
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;

  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Invalid month format. Use YYYY-MM.');
  }

  const startOfMonth = new Date(year, monthIndex, 1);
  const endOfMonth = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { startOfMonth, endOfMonth };
};

const fetchMonthlyDeals = async (startOfMonth, endOfMonth) => {
  const deals = await Deal.aggregate([
    {
      $match: {
        status: 'active',
        $and: [
          {
            $or: [
              { dealStartAt: { $lte: endOfMonth } },
              { dealStartAt: null },
              { dealStartAt: { $exists: false } }
            ]
          },
          {
            $or: [
              { dealEndsAt: { $gte: startOfMonth } },
              { dealEndsAt: null },
              { dealEndsAt: { $exists: false } }
            ]
          }
        ]
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
        avgOriginalCost: {
          $cond: {
            if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
            then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.originalCost' } } },
            else: { $ifNull: ['$originalCost', 0] }
          }
        },
        avgDiscountPrice: {
          $cond: {
            if: { $gt: [{ $size: { $ifNull: ['$sizes', []] } }, 0] },
            then: { $avg: { $map: { input: '$sizes', as: 'size', in: '$$size.discountPrice' } } },
            else: { $ifNull: ['$discountPrice', 0] }
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
        originalCost: 1,
        discountPrice: 1,
        avgOriginalCost: 1,
        avgDiscountPrice: 1,
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
    },
    { $sort: { name: 1 } }
  ]);

  return deals.map((deal) => {
    const avgOriginalCost = deal.avgOriginalCost || 0;
    const avgDiscountPrice = deal.avgDiscountPrice || 0;
    const avgSavingsPerUnit = avgOriginalCost - avgDiscountPrice;
    const avgSavingsPercentage = avgOriginalCost
      ? ((avgSavingsPerUnit / avgOriginalCost) * 100).toFixed(2)
      : '0.00';

    if (!deal.sizes || deal.sizes.length === 0) {
      deal.sizes = [{
        size: 'Standard',
        originalCost: deal.originalCost || avgOriginalCost,
        discountPrice: deal.discountPrice || avgDiscountPrice,
        discountTiers: deal.discountTiers || []
      }];
    }

    const maxSavingsPercentage = deal.sizes.reduce((max, size) => {
      if (!size || typeof size.originalCost !== 'number' || size.originalCost === 0) return max;
      const savings = ((size.originalCost - size.discountPrice) / size.originalCost) * 100;
      return savings > max ? savings : max;
    }, 0).toFixed(2);

    return {
      ...deal,
      avgSavingsPerUnit,
      avgSavingsPercentage,
      maxSavingsPercentage,
      totalPotentialSavings: avgSavingsPerUnit * (deal.minQtyForDiscount || 0),
      remainingQuantity: Math.max(0, (deal.minQtyForDiscount || 0) - (deal.totalCommittedQuantity || 0))
    };
  });
};

const generateDealsPdf = (deals, monthLabel) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
  const buffers = [];

  doc.on('data', (buffer) => buffers.push(buffer));
  doc.on('end', () => resolve(Buffer.concat(buffers)));
  doc.on('error', (err) => reject(err));

  doc.fontSize(20).text(`Available Deals for ${monthLabel}`, { align: 'center' });
  doc.moveDown();

  if (!deals.length) {
    doc.fontSize(12).text('No active deals found for this month.', { align: 'center' });
    doc.end();
    return;
  }

  deals.forEach((deal, index) => {
    doc.fontSize(14).text(`${index + 1}. ${deal.name}`, { underline: true });
    doc.moveDown(0.2);

    doc.fontSize(10);
    doc.text(`Category: ${deal.category || 'N/A'}`);
    doc.text(`Distributor: ${deal.distributor?.businessName || deal.distributor?.name || 'N/A'}`);
    doc.text(`Deal Window: ${formatDateRange(deal.dealStartAt, deal.dealEndsAt)}`);
    doc.text(`Commitment Window: ${formatDateRange(deal.commitmentStartAt, deal.commitmentEndsAt)}`);
    doc.text(`Minimum Quantity for Discount: ${deal.minQtyForDiscount ?? 'N/A'}`);
    doc.text(`Total Committed Quantity: ${deal.totalCommittedQuantity || 0}`);

    if (deal.description) {
      doc.moveDown(0.2);
      doc.text(`Description: ${deal.description}`, { width: 500 });
    }

    doc.moveDown(0.4);
    doc.text('Sizes & Pricing:', { continued: false, underline: true });

    deal.sizes.forEach((size) => {
      doc.text(` • ${size.name || size.size || 'Standard'} (${size.size || 'N/A'})`);
      doc.text(`   Original Price: $${formatCurrencyValue(size.originalCost)} | Discount Price: $${formatCurrencyValue(size.discountPrice)}`);

      const tierLabel = buildDiscountTierLabel(size.discountTiers);
      if (tierLabel) {
        doc.text(`   Volume Tiers: ${tierLabel}`);
      }
    });

    doc.moveDown();

    if (doc.y >= doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage();
    }
  });

  doc.end();
});

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
    await logError(req, 'view_admin_all_deals', 'deals', error);
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

router.get('/buy/export', isAuthenticated, async (req, res) => {
  try {
    const { currentUser } = getCurrentUserContext(req);
    const userRole = currentUser?.role;

    if (!userRole || (userRole !== 'member' && userRole !== 'admin')) {
      return res.status(403).json({
        message: 'Access denied. Only members can export deals.',
        success: false
      });
    }

    const format = (req.query.format || 'csv').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        message: 'Invalid format. Use "csv" or "pdf".',
        success: false
      });
    }

    let startOfMonth;
    let endOfMonth;

    try {
      ({ startOfMonth, endOfMonth } = getMonthBounds(req.query.month));
    } catch (err) {
      return res.status(400).json({
        message: err.message,
        success: false 
      });
    }

    const deals = await fetchMonthlyDeals(startOfMonth, endOfMonth);
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(startOfMonth);
    const safeMonthSlug = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}`;

    if (format === 'csv') {
      const header = [
        'Deal Name',
        'Category',
        'Distributor',
        'Deal Start',
        'Deal End',
        'Commitment Start',
        'Commitment End',
        'Minimum Quantity',
        'Size Name',
        'Size',
        'Original Price',
        'Discount Price',
        'Volume Discount Tiers',
        'Total Committed Quantity'
      ];

      const rows = deals.flatMap((deal) => {
        const distributorName = deal.distributor?.businessName || deal.distributor?.name || 'N/A';

        return (deal.sizes || []).map((size) => ([
          deal.name,
          deal.category || 'N/A',
          distributorName,
          formatDate(deal.dealStartAt),
          formatDate(deal.dealEndsAt),
          formatDate(deal.commitmentStartAt),
          formatDate(deal.commitmentEndsAt),
          deal.minQtyForDiscount ?? '',
          size.name || size.size || 'Standard',
          size.size || '',
          formatCurrencyValue(size.originalCost),
          formatCurrencyValue(size.discountPrice),
          buildDiscountTierLabel(size.discountTiers),
          deal.totalCommittedQuantity || 0
        ]));
      });

      if (!rows.length) {
        rows.push([
          'No active deals found for this month',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          ''
        ]);
      }

      const csvContent = convertArrayToCSV(rows, { header });
      const fileName = `available-deals-${safeMonthSlug}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.status(200).send(`\ufeff${csvContent}`);
    } else {
      const pdfBuffer = await generateDealsPdf(deals, monthLabel);
      const fileName = `available-deals-${safeMonthSlug}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.status(200).send(pdfBuffer);
    }

    await logCollaboratorAction(req, 'export_available_deals', 'deals', {
      format,
      totalDeals: deals.length,
      month: safeMonthSlug
    });
  } catch (error) {
    console.error('Error exporting deals:', error);
    await logError(req, 'export_available_deals', 'deals', error, {
      format: req.query.format
    });
    res.status(500).json({
      message: 'Error exporting deals',
      error: error.message
    });
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
    await logError(req, 'view_available_deals', 'deals', error, {
      page: req.query.page,
      searchQuery: req.query.searchQuery,
      category: req.query.category
    });
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

module.exports = router;
