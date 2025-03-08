const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');

router.get('/', async (req, res) => {
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
          totalCommitments: { $size: '$commitments' },
          totalCommitmentQuantity: { 
            $sum: '$commitmentDetails.quantity' 
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          size: 1,
          originalCost: 1,
          discountPrice: 1,
          category: 1,
          status: 1,
          dealEndsAt: 1,
          minQtyForDiscount: 1,
          images: 1,
          totalSold: 1,
          totalRevenue: 1,
          views: 1,
          impressions: 1,
          distributor: 1,
          totalCommitments: 1,
          totalCommitmentQuantity: 1
        }
      }
    ]);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deals', error });
  }
});

router.get('/buy', async (req, res) => {
  try {
    // Increment impressions for all active deals being displayed
    const deals = await Deal.aggregate([
      { $match: { status: 'active' } },
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
          totalCommitments: { $size: '$commitments' },
          totalCommitmentQuantity: { 
            $sum: '$commitmentDetails.quantity' 
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          size: 1,
          originalCost: 1,
          discountPrice: 1,
          category: 1,
          status: 1,
          dealEndsAt: 1,
          minQtyForDiscount: 1,
          images: 1,
          totalSold: 1,
          totalRevenue: 1,
          views: 1,
          impressions: 1,
          distributor: 1,
          totalCommitments: 1,
          totalCommitmentQuantity: 1
        }
      }
    ]);
    
    // Update impressions in bulk
    await Promise.all(
      deals.map(deal => 
        Deal.findByIdAndUpdate(deal._id, { $inc: { impressions: 1 } })
      )
    );

    res.json(deals);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching deals', error });
  }
});

module.exports = router;
