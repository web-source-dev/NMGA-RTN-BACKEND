const express = require('express');
const router = express.Router();
const Deal = require('../../models/Deals');
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Compare = require('../../models/Compare');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const csv = require('csv-parser');
const mongoose = require('mongoose');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage (we'll upload to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Accept only CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      return cb(null, true);
    }
    return cb(new Error('Only CSV files are allowed'), false);
  },
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
router.get('/', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
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
    
    // Log the action
    await logCollaboratorAction(req, 'view_comparison_deals', 'comparison deals', {
      additionalInfo: `Found ${dealsWithComparisonsInMonth.length} deals`,
      monthFilter: monthFilter || 'all'
    });
    
    res.status(200).json(dealsWithCompareStatus);
  } catch (error) {
    console.error('Error fetching deals for comparison:', error);
    
    // Log the error
    await logError(req, 'view_comparison_deals', 'comparison deals', error, {
      monthFilter: req.query.monthFilter || 'all'
    });
    
    res.status(500).json({ message: 'Error fetching deals', error: error.message });
  }
});

// Get sample CSV template for a specific deal
router.get('/template/:dealId', isDistributorAdmin, async (req, res) => {
  try {
    const userContext = getCurrentUserContext(req);
    if (!userContext || !userContext.currentUser) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { currentUser, originalUser, isImpersonating } = userContext;
    const distributorId = currentUser.id;
    const { dealId } = req.params;
    
    const deal = await Deal.findById(dealId).lean();
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if the deal belongs to this distributor
    if (deal.distributor.toString() !== distributorId.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this deal' });
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
    
    // Log the action
    await logCollaboratorAction(req, 'download_comparison_template', 'comparison template', {
      dealTitle: deal.name,
      dealId: dealId
    });
    
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error generating template:', error);
    
    // Log the error
    await logError(req, 'download_comparison_template', 'comparison template', error, {
      dealId: req.params.dealId
    });
    
    res.status(500).json({ message: 'Error generating template', error: error.message });
  }
});

// Upload and process CSV for comparison
router.post('/upload/:dealId', 
  isDistributorAdmin,
  upload.single('comparisonFile'),
  handleMulterError,
  async (req, res) => {
  try {
    console.log('Upload request received:', req.params, req.body);
    console.log('File:', req.file);
    
    const userContext = getCurrentUserContext(req);
    console.log('User context:', userContext);
    
    if (!userContext || !userContext.currentUser) {
      console.error('No user context found in request');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { currentUser, originalUser, isImpersonating } = userContext;
    const distributorId = currentUser.id;
    const { dealId } = req.params;
    
    console.log('Current user:', currentUser);
    console.log('Distributor ID:', distributorId);
    console.log('Deal ID:', dealId);
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      return res.status(400).json({ message: 'Invalid deal ID format' });
    }
    
    const deal = await Deal.findById(dealId).lean();
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }
    
    // Check if the deal belongs to this distributor
    if (deal.distributor.toString() !== distributorId.toString()) {
      return res.status(403).json({ message: 'Not authorized to compare this deal' });
    }
    
    // Upload file to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'comparison-files',
            format: 'csv'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        uploadStream.end(req.file.buffer);
      });
    } catch (cloudinaryError) {
      console.error('Cloudinary upload error:', cloudinaryError);
      return res.status(500).json({ message: 'Error uploading file to cloud storage' });
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
    
    // Process CSV file from buffer
    const comparisonItems = [];
    let totalCommittedQuantity = 0;
    let totalActualQuantity = 0;
    let totalCommittedPrice = 0;
    let totalActualPrice = 0;
    
    const results = [];
    
    // Parse CSV from buffer
    try {
      const csvString = req.file.buffer.toString('utf8');
      const lines = csvString.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          results.push(row);
        }
      }
    } catch (error) {
      return res.status(400).json({ 
        message: `CSV parsing error: ${error.message}`, 
        error: error.message 
      });
    }
    
    if (results.length === 0) {
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
      return res.status(400).json({ message: 'No valid data found in CSV file' });
    }
    
    // Create comparison record
    const compareRecord = new Compare({
      dealId,
      distributorId,
      dealName: deal.name,
      fileName: req.file.originalname,
      cloudinaryUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
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
    
    // Log the action
    await logCollaboratorAction(req, 'upload_comparison_data', 'comparison data', {
      dealTitle: deal.name,
      dealId: dealId,
      fileName: req.file.originalname,
      additionalInfo: `Processed ${comparisonItems.length} comparison items`
    });
    
    res.status(201).json({
      message: 'Comparison data processed successfully',
      compareId: compareRecord._id,
      summary: compareRecord.summary
    });
  } catch (error) {
    console.error('Error processing comparison:', error);
    
    // Log the error
    await logError(req, 'upload_comparison_data', 'comparison data', error, {
      dealId: req.params.dealId,
      fileName: req.file?.originalname
    });
    
    res.status(500).json({ 
      message: 'Error processing comparison', 
      error: error.message || 'Unknown error' 
    });
  }
});

// Get comparison details by ID
router.get('/details/:compareId', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    const { compareId } = req.params;
    
    const comparison = await Compare.findById(compareId)
      .populate('dealId', 'name description')
      .lean();
    
    if (!comparison) {
      return res.status(404).json({ message: 'Comparison not found' });
    }
    
    // Check if the comparison belongs to this distributor
    if (comparison.distributorId.toString() !== distributorId.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this comparison' });
    }
    
    // Log the action
    await logCollaboratorAction(req, 'view_comparison_details', 'comparison details', {
      compareId: compareId
    });
    
    res.status(200).json(comparison);
  } catch (error) {
    console.error('Error fetching comparison details:', error);
    
    // Log the error
    await logError(req, 'view_comparison_details', 'comparison details', error, {
      compareId: req.params.compareId
    });
    
    res.status(500).json({ message: 'Error fetching comparison details', error: error.message });
  }
});

// Get all comparisons for a specific deal
router.get('/history/:dealId', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    const { dealId } = req.params;
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
    
    // Log the action
    await logCollaboratorAction(req, 'view_comparison_history', 'comparison history', {
      dealId: dealId,
      additionalInfo: `Found ${comparisons.length} comparisons`,
      monthFilter: monthFilter || 'all'
    });
    
    res.status(200).json(comparisons);
  } catch (error) {
    console.error('Error fetching comparison history:', error);
    
    // Log the error
    await logError(req, 'view_comparison_history', 'comparison history', error, {
      dealId: req.params.dealId,
      monthFilter: req.query.monthFilter || 'all'
    });
    
    res.status(500).json({ message: 'Error fetching comparison history', error: error.message });
  }
});

module.exports = router;
