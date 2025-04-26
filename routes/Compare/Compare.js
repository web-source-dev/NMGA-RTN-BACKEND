const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Compare = require('../../models/Compare');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');

// Set up multer for file upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    try {
      const uploadDir = path.join(__dirname, '../../uploads/comparisons');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(new Error('Could not create upload directory'));
    }
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only CSV files
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    return cb(null, true);
  }
  return cb(new Error('Only CSV files are allowed'), false);
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware to handle multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum file size is 10MB.'
      });
    }
    return res.status(400).json({ 
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(400).json({ 
      message: err.message || 'An error occurred during file upload'
    });
  }
  
  // No error occurred, continue
  next();
};

// Get all deals for the distributor
router.get('/:distributorId', async (req, res) => {
  try {
    const { distributorId } = req.params;
    const { monthFilter } = req.query; // Get monthFilter from query params
    
    // Create date filter for comparisons
    let dateFilter = {};
    let startOfMonth, endOfMonth;
    
    if (monthFilter && monthFilter !== 'all') {
      if (monthFilter === 'current') {
        // Current month filter
        const now = new Date();
        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (monthFilter.match(/^\d{4}-\d{2}$/)) {
        // Specific month in format YYYY-MM
        const [year, month] = monthFilter.split('-').map(num => parseInt(num));
        startOfMonth = new Date(year, month - 1, 1);
        endOfMonth = new Date(year, month, 0, 23, 59, 59);
      }
      
      if (startOfMonth && endOfMonth) {
        dateFilter = {
          createdAt: { 
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        };
      }
    }
    
    // Get all deals for the distributor
    const deals = await Deal.find({ distributor: distributorId })
      .select('_id name description category status dealStartAt dealEndsAt images')
      .lean();
    
    // If filtering by month, first find all deals with comparisons in that month
    let dealsWithComparisonsInMonth = [];
    
    if (monthFilter && monthFilter !== 'all') {
      // Find all comparisons in the selected month
      const comparisonsInMonth = await Compare.find({
        distributorId,
        ...dateFilter
      }).select('dealId').lean();
      
      // Get unique deal IDs
      const dealIdsWithComparisons = [...new Set(comparisonsInMonth.map(comp => comp.dealId.toString()))];
      
      // Only keep deals that have comparisons in the selected month
      dealsWithComparisonsInMonth = deals.filter(deal => 
        dealIdsWithComparisons.includes(deal._id.toString())
      );
    } else {
      // If showing all months, include all deals
      dealsWithComparisonsInMonth = deals;
    }
    
    // Get comparison data for each deal
    const dealsWithCompareStatus = await Promise.all(dealsWithComparisonsInMonth.map(async (deal) => {
      // Find the latest comparison with date filter
      const query = { 
        dealId: deal._id,
        distributorId
      };
      
      // Add date filter only if filtering by month
      if (monthFilter && monthFilter !== 'all') {
        Object.assign(query, dateFilter);
      }
      
      const latestCompare = await Compare.findOne(query)
        .sort({ createdAt: -1 })
        .select('createdAt summary')
        .lean();
      
      return {
        ...deal,
        hasComparison: !!latestCompare,
        lastCompared: latestCompare ? latestCompare.createdAt : null,
        comparisonSummary: latestCompare ? latestCompare.summary : null
      };
    }));
    
    res.status(200).json(dealsWithCompareStatus);
  } catch (error) {
    console.error('Error fetching deals for comparison:', error);
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

// Get sample CSV template for a specific deal
router.get('/template/:dealId', async (req, res) => {
  try {
    const { dealId } = req.params;
    
    const deal = await Deal.findById(dealId).lean();
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Get all commitments for this deal
    const commitments = await Commitment.find({ 
      dealId,
      status: { $ne: 'cancelled' }
    }).populate('userId', 'name email businessName').lean();
    
    if (commitments.length === 0) {
      return res.status(404).json({ message: 'No commitments found for this deal' });
    }
    
    // Generate CSV header
    let csvContent = 'memberId,memberName,commitmentId,size,committedQuantity,actualQuantity,committedPrice,actualPrice\n';
    
    // Generate CSV rows for each commitment and size
    commitments.forEach(commitment => {
      const memberName = commitment.userId.businessName || commitment.userId.name;
      
      commitment.sizeCommitments.forEach(sizeCommitment => {
        csvContent += `${commitment.userId._id},${memberName},${commitment._id},${sizeCommitment.size},${sizeCommitment.quantity},${sizeCommitment.quantity},${sizeCommitment.pricePerUnit},${sizeCommitment.pricePerUnit}\n`;
      });
    });
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=comparison-template-${dealId}.csv`);
    
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: 'Error generating template', error: error.message });
  }
});

// Upload and process CSV for comparison
router.post('/upload/:dealId/:distributorId', 
  (req, res, next) => {
    upload.single('comparisonFile')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          message: err.message || 'Error uploading file'
        });
      }
      next();
    });
  }, 
  async (req, res) => {
  try {
    const { dealId, distributorId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(distributorId)) {
      return res.status(400).json({ message: 'Invalid distributor ID format' });
    }
    
    const deal = await Deal.findById(dealId).lean();
    if (!deal) {
      // Clean up the uploaded file if deal not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if the deal belongs to the distributor
    if (deal.distributor.toString() !== distributorId) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: 'Not authorized to compare this deal' });
    }
    
    // Get all commitments for this deal to compare against
    const commitments = await Commitment.find({ 
      dealId,
      status: { $ne: 'cancelled' }
    }).populate('userId', 'name email businessName').lean();
    
    // Create a lookup map for commitments by member
    const commitmentMap = new Map();
    commitments.forEach(commitment => {
      commitment.sizeCommitments.forEach(sizeCommitment => {
        const key = `${commitment.userId._id}-${sizeCommitment.size}`;
        commitmentMap.set(key, {
          memberId: commitment.userId._id,
          memberName: commitment.userId.businessName || commitment.userId.name,
          commitmentId: commitment._id,
          size: sizeCommitment.size,
          committedQuantity: sizeCommitment.quantity,
          committedPrice: sizeCommitment.pricePerUnit,
          totalCommittedPrice: sizeCommitment.totalPrice
        });
      });
    });
    
    // Process CSV file
    const comparisonItems = [];
    let totalCommittedQuantity = 0;
    let totalActualQuantity = 0;
    let totalCommittedPrice = 0;
    let totalActualPrice = 0;
    
    const results = [];
    
    // Using a Promise to handle the CSV parsing
    try {
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (data) => {
            // Validate data fields
            if (!data.memberId || !data.size || !data.committedQuantity || !data.actualQuantity) {
              reject(new Error('CSV missing required fields: memberId, size, committedQuantity, actualQuantity'));
              return;
            }
            results.push(data);
          })
          .on('end', () => resolve())
          .on('error', (error) => reject(error));
      });
    } catch (error) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        message: `CSV parsing error: ${error.message}`, 
        error: error.message 
      });
    }
    
    if (results.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'CSV file is empty or has invalid format' });
    }
    
    // Process results
    results.forEach(row => {
      try {
        const committedQty = parseInt(row.committedQuantity) || 0;
        const actualQty = parseInt(row.actualQuantity) || 0;
        const committedPrice = parseFloat(row.committedPrice) || 0;
        const actualPrice = parseFloat(row.actualPrice) || 0;
        
        // Validate number values
        if (isNaN(committedQty) || isNaN(actualQty) || isNaN(committedPrice) || isNaN(actualPrice)) {
          throw new Error('Invalid numeric values in CSV');
        }
        
        // Validate memberId format
        if (!mongoose.Types.ObjectId.isValid(row.memberId)) {
          throw new Error(`Invalid member ID format: ${row.memberId}`);
        }
        
        // Create comparison item
        const comparisonItem = {
          memberId: row.memberId,
          memberName: row.memberName,
          commitmentId: row.commitmentId,
          size: row.size,
          committedQuantity: committedQty,
          actualQuantity: actualQty,
          committedPrice: committedPrice,
          actualPrice: actualPrice,
          quantityDifference: actualQty - committedQty,
          priceDifference: (actualQty * actualPrice) - (committedQty * committedPrice)
        };
        
        comparisonItems.push(comparisonItem);
        
        // Update totals
        totalCommittedQuantity += committedQty;
        totalActualQuantity += actualQty;
        totalCommittedPrice += committedQty * committedPrice;
        totalActualPrice += actualQty * actualPrice;
      } catch (error) {
        console.error(`Error processing row in CSV: ${JSON.stringify(row)}`, error);
        // Continue processing other rows
      }
    });
    
    if (comparisonItems.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'No valid data found in CSV file' });
    }
    
    // Create comparison record
    const compareRecord = new Compare({
      dealId,
      distributorId,
      dealName: deal.name,
      fileName: req.file.filename,
      comparisonItems,
      summary: {
        totalCommittedQuantity,
        totalActualQuantity,
        totalCommittedPrice,
        totalActualPrice,
        quantityDifferenceTotal: totalActualQuantity - totalCommittedQuantity,
        priceDifferenceTotal: totalActualPrice - totalCommittedPrice
      }
    });
    
    await compareRecord.save();
    
    res.status(201).json({
      message: 'Comparison data processed successfully',
      compareId: compareRecord._id,
      summary: compareRecord.summary
    });
  } catch (error) {
    console.error('Error processing comparison:', error);
    // Delete the uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ 
      message: 'Error processing comparison', 
      error: error.message || 'Unknown error' 
    });
  }
});

// Get comparison details by ID
router.get('/details/:compareId', async (req, res) => {
  try {
    const { compareId } = req.params;
    
    const comparison = await Compare.findById(compareId)
      .populate('dealId', 'name description')
      .lean();
    
    if (!comparison) {
      return res.status(404).json({ message: 'Comparison not found' });
    }
    
    res.status(200).json(comparison);
  } catch (error) {
    console.error('Error fetching comparison details:', error);
    res.status(500).json({ message: 'Error fetching comparison details', error: error.message });
  }
});

// Get all comparisons for a specific deal
router.get('/history/:dealId/:distributorId', async (req, res) => {
  try {
    const { dealId, distributorId } = req.params;
    const { monthFilter } = req.query; // Get monthFilter from query params
    
    // Create date filter query
    let dateFilter = {};
    
    if (monthFilter) {
      if (monthFilter === 'current') {
        // Current month filter
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        dateFilter = {
          createdAt: { 
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        };
      } else if (monthFilter.match(/^\d{4}-\d{2}$/)) {
        // Specific month in format YYYY-MM
        const [year, month] = monthFilter.split('-').map(num => parseInt(num));
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        dateFilter = {
          createdAt: { 
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        };
      }
    }
    
    const comparisons = await Compare.find({ 
      dealId,
      distributorId,
      ...dateFilter
    })
    .sort({ createdAt: -1 })
    .select('_id dealName fileName uploadDate summary createdAt')
    .lean();
    
    res.status(200).json(comparisons);
  } catch (error) {
    console.error('Error fetching comparison history:', error);
    res.status(500).json({ message: 'Error fetching comparison history', error: error.message });
  }
});

module.exports = router;
