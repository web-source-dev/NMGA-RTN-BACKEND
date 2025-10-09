const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');
const Supplier = require('../../models/Suppliers');
const { isDistributorAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Get all members with commitments for a distributor
router.get('/members-with-commitments', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    const { page = 1, limit = 10, search = '', status = '', supplier = '', startDate = '', endDate = '' } = req.query;

    // First, get all deals by this distributor
    const distributorDeals = await Deal.find({ distributor: distributorId }).select('_id name category status');
    
    if (distributorDeals.length === 0) {
      return res.json({
        members: [],
        stats: {
          totalMembers: 0,
          totalCommitments: 0,
          totalRevenue: 0,
          activeSuppliers: 0
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    const dealIds = distributorDeals.map(deal => deal._id);

    // Build query for commitments
    let commitmentQuery = {
      dealId: { $in: dealIds }
    };

    // Add date range filter if provided
    if (startDate && endDate) {
      // Validate dates before creating Date objects
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        commitmentQuery.createdAt = {
          $gte: startDateObj,
          $lte: endDateObj
        };
      }
    }

    // Get all commitments for the distributor's deals
    const commitments = await Commitment.find(commitmentQuery)
      .populate({
        path: 'userId',
        select: 'name email businessName contactPerson phone address role isBlocked isVerified'
      })
      .populate({
        path: 'dealId',
        select: 'name category status'
      })
      .sort({ createdAt: -1 });

    console.log(`Found ${commitments.length} commitments for distributor ${distributorId}`);
    console.log(`Found ${distributorDeals.length} deals for distributor ${distributorId}`);

    // Group commitments by user
    const memberCommitments = {};
    commitments.forEach(commitment => {
      // Skip commitments with null or missing userId
      if (!commitment.userId || !commitment.userId._id) {
        console.warn('Skipping commitment with null userId:', commitment._id);
        return;
      }
      
      const userId = commitment.userId._id.toString();
      if (!memberCommitments[userId]) {
        memberCommitments[userId] = {
          _id: commitment.userId._id,
          name: commitment.userId.name,
          email: commitment.userId.email,
          businessName: commitment.userId.businessName,
          contactPerson: commitment.userId.contactPerson,
          phone: commitment.userId.phone,
          address: commitment.userId.address,
          role: commitment.userId.role,
          isBlocked: commitment.userId.isBlocked,
          isVerified: commitment.userId.isVerified,
          commitments: [],
          totalCommitments: 0,
          totalAmount: 0,
          lastCommitmentDate: null
        };
      }
      
      memberCommitments[userId].commitments.push({
        _id: commitment._id,
        dealName: commitment.dealId?.name || 'Unknown Deal',
        dealCategory: commitment.dealId?.category || 'Unknown',
        dealStatus: commitment.dealId?.status || 'Unknown',
        status: commitment.status || 'Unknown',
        totalPrice: commitment.totalPrice || 0,
        sizeCommitments: commitment.sizeCommitments,
        quantity: commitment.sizeCommitments ? 
          commitment.sizeCommitments.reduce((sum, item) => sum + (item.quantity || 0), 0) : 
          commitment.quantity || 0,
        createdAt: commitment.createdAt
      });
      
      memberCommitments[userId].totalCommitments++;
      memberCommitments[userId].totalAmount += (commitment.totalPrice || 0);
      
      if (!memberCommitments[userId].lastCommitmentDate || 
          new Date(commitment.createdAt) > new Date(memberCommitments[userId].lastCommitmentDate)) {
        memberCommitments[userId].lastCommitmentDate = commitment.createdAt;
      }
    });

    // Convert to array and apply filters
    let members = Object.values(memberCommitments);

    // If no members found from commitments, try to get all users who are members
    if (members.length === 0) {
      console.log('No members found from commitments, fetching all member users...');
      const allMembers = await User.find({ 
        role: 'member',
        isBlocked: false 
      }).select('name email businessName contactPerson phone address role isBlocked isVerified');
      
      members = allMembers.map(member => ({
        _id: member._id,
        name: member.name,
        email: member.email,
        businessName: member.businessName,
        contactPerson: member.contactPerson,
        phone: member.phone,
        address: member.address,
        role: member.role,
        isBlocked: member.isBlocked,
        isVerified: member.isVerified,
        commitments: [],
        totalCommitments: 0,
        totalAmount: 0,
        lastCommitmentDate: null,
        status: member.isBlocked ? 'inactive' : 'active'
      }));
    }

    // Apply search filter
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      members = members.filter(member => 
        member.name?.toLowerCase().includes(searchLower) ||
        member.businessName?.toLowerCase().includes(searchLower) ||
        member.email?.toLowerCase().includes(searchLower) ||
        member.contactPerson?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (status) {
      members = members.filter(member => {
        if (status === 'active') return !member.isBlocked;
        if (status === 'inactive') return member.isBlocked;
        if (status === 'pending') return member.commitments.some(c => c.status === 'pending');
        if (status === 'approved') return member.commitments.some(c => c.status === 'approved');
        if (status === 'declined') return member.commitments.some(c => c.status === 'declined');
        return true;
      });
    }

    // Get supplier assignments for all members
    const memberIds = members.map(m => m._id);
    const suppliers = await Supplier.find({
      assignedTo: { $in: memberIds }
    }).populate('assignedTo', '_id name businessName');

    // Create supplier lookup map
    const supplierMap = {};
    suppliers.forEach(supplier => {
      supplier.assignedTo.forEach(user => {
        supplierMap[user._id.toString()] = {
          name: supplier.name,
          email: supplier.email,
          assignedAt: supplier.assignedAt
        };
      });
    });

    // Add supplier info to members
    members = members.map(member => ({
      ...member,
      assignedSupplier: supplierMap[member._id.toString()] || null,
      status: member.isBlocked ? 'inactive' : 'active'
    }));

    // Apply supplier filter
    if (supplier) {
      if (supplier === 'assigned') {
        members = members.filter(member => member.assignedSupplier);
      } else if (supplier === 'unassigned') {
        members = members.filter(member => !member.assignedSupplier);
      }
    }

    // Calculate stats
    const stats = {
      totalMembers: members.length,
      totalCommitments: members.reduce((sum, member) => sum + member.totalCommitments, 0),
      totalRevenue: members.reduce((sum, member) => sum + member.totalAmount, 0),
      activeSuppliers: new Set(members.filter(m => m.assignedSupplier).map(m => m.assignedSupplier.name)).size
    };

    // Pagination
    const totalItems = members.length;
    const totalPages = Math.ceil(totalItems / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = members.slice(startIndex, endIndex);

    // Log the action with admin impersonation details if applicable
    await logCollaboratorAction(req, 'view_members_with_commitments', 'members', { 
      totalMembers: paginatedMembers.length,
      totalCommitments: stats.totalCommitments,
      totalRevenue: stats.totalRevenue,
      activeSuppliers: stats.activeSuppliers,
      additionalInfo: `Viewed members with commitments data`
    });

    res.json({
      members: paginatedMembers,
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching members with commitments:', error);
    
    // Log the error with admin impersonation details if applicable
    await logError(req, 'view_members_with_commitments', 'members', error, {
      search: req.query.search,
      status: req.query.status,
      supplier: req.query.supplier
    });
    
    res.status(500).json({ error: 'Failed to fetch members with commitments' });
  }
});

// Get detailed member information
router.get('/member-details/:memberId', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    const { memberId } = req.params;

    console.log('Member details request:', { memberId, distributorId });

    // Get member details
    const member = await User.findById(memberId).select('-password');
    if (!member) {
      console.log('Member not found:', memberId);
      return res.status(404).json({ error: 'Member not found' });
    }

    console.log('Found member:', member.name, member.email);

    // First, get all deals by this distributor
    const distributorDeals = await Deal.find({ distributor: distributorId }).select('_id name category status');
    console.log('Found distributor deals:', distributorDeals.length);

    // Get all commitments for this member on distributor's deals
    const commitments = await Commitment.find({
      userId: memberId,
      dealId: { $in: distributorDeals.map(deal => deal._id) }
    })
    .populate({
      path: 'dealId',
      select: 'name category status description'
    })
    .sort({ createdAt: -1 });

    console.log('Found commitments for member:', commitments.length);

    // Get supplier assignment
    const supplier = await Supplier.findOne({
      assignedTo: memberId
    });

    console.log('Found supplier:', supplier ? supplier.name : 'No supplier assigned');

    // Calculate member stats
    const totalCommitments = commitments.length;
    const totalAmount = commitments.reduce((sum, commitment) => sum + commitment.totalPrice, 0);
    const lastCommitmentDate = commitments.length > 0 ? commitments[0].createdAt : null;

    // Group commitments by status
    const commitmentsByStatus = commitments.reduce((acc, commitment) => {
      const status = commitment.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(commitment);
      return acc;
    }, {});

    const memberDetails = {
      ...member.toObject(),
      totalCommitments,
      totalAmount,
      lastCommitmentDate,
      commitments: commitments.map(commitment => ({
        _id: commitment._id,
        dealName: commitment.dealId.name,
        dealCategory: commitment.dealId.category,
        dealStatus: commitment.dealId.status,
        status: commitment.status,
        totalPrice: commitment.totalPrice,
        sizeCommitments: commitment.sizeCommitments,
        quantity: commitment.sizeCommitments ? 
          commitment.sizeCommitments.reduce((sum, item) => sum + item.quantity, 0) : 
          commitment.quantity || 0,
        createdAt: commitment.createdAt,
        distributorResponse: commitment.distributorResponse
      })),
      commitmentsByStatus,
      assignedSupplier: supplier ? {
        name: supplier.name,
        email: supplier.email,
        assignedAt: supplier.assignedAt
      } : null,
      status: member.isBlocked ? 'inactive' : 'active'
    };

    // Log the action with admin impersonation details if applicable
    await logCollaboratorAction(req, 'view_member_details', 'member', { 
      memberId: memberId,
      memberName: memberDetails.name,
      totalCommitments: memberDetails.totalCommitments,
      totalAmount: memberDetails.totalAmount,
      hasSupplier: !!memberDetails.assignedSupplier,
      additionalInfo: `Viewed detailed member information`
    });

    console.log('Sending member details response:', {
      memberName: memberDetails.name,
      totalCommitments: memberDetails.totalCommitments,
      totalAmount: memberDetails.totalAmount,
      hasSupplier: !!memberDetails.assignedSupplier
    });

    res.json(memberDetails);

  } catch (error) {
    console.error('Error fetching member details:', error);
    
    // Log the error with admin impersonation details if applicable
    await logError(req, 'view_member_details', 'member', error, {
      memberId: req.params.memberId
    });
    
    res.status(500).json({ error: 'Failed to fetch member details' });
  }
});

// Get commitment analytics for a member
router.get('/member-analytics/:memberId', isDistributorAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const distributorId = currentUser.id;
    const { memberId } = req.params;

    // First, get all deals by this distributor
    const distributorDeals = await Deal.find({ distributor: distributorId }).select('_id name category');

    // Get all commitments for this member on distributor's deals
    const commitments = await Commitment.find({
      userId: memberId,
      dealId: { $in: distributorDeals.map(deal => deal._id) }
    })
    .populate('dealId', 'name category')
    .sort({ createdAt: -1 });

    // Calculate analytics
    const totalCommitments = commitments.length;
    const totalAmount = commitments.reduce((sum, c) => sum + c.totalPrice, 0);
    const averageCommitmentValue = totalCommitments > 0 ? totalAmount / totalCommitments : 0;

    // Group by status
    const statusBreakdown = commitments.reduce((acc, commitment) => {
      const status = commitment.status;
      if (!acc[status]) acc[status] = { count: 0, amount: 0 };
      acc[status].count++;
      acc[status].amount += commitment.totalPrice;
      return acc;
    }, {});

    // Group by month for trend analysis
    const monthlyTrends = commitments.reduce((acc, commitment) => {
      const month = new Date(commitment.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) acc[month] = { count: 0, amount: 0 };
      acc[month].count++;
      acc[month].amount += commitment.totalPrice;
      return acc;
    }, {});

    // Category breakdown
    const categoryBreakdown = commitments.reduce((acc, commitment) => {
      const category = commitment.dealId.category;
      if (!acc[category]) acc[category] = { count: 0, amount: 0 };
      acc[category].count++;
      acc[category].amount += commitment.totalPrice;
      return acc;
    }, {});

    const analytics = {
      totalCommitments,
      totalAmount,
      averageCommitmentValue,
      statusBreakdown,
      monthlyTrends,
      categoryBreakdown,
      recentActivity: commitments.slice(0, 10) // Last 10 commitments
    };

    // Log the action with admin impersonation details if applicable
    await logCollaboratorAction(req, 'view_member_analytics', 'member', { 
      memberId: memberId,
      totalCommitments: analytics.totalCommitments,
      totalAmount: analytics.totalAmount,
      averageCommitmentValue: analytics.averageCommitmentValue,
      additionalInfo: `Viewed member analytics data`
    });

    res.json(analytics);

  } catch (error) {
    console.error('Error fetching member analytics:', error);
    
    // Log the error with admin impersonation details if applicable
    await logError(req, 'view_member_analytics', 'member', error, {
      memberId: req.params.memberId
    });
    
    res.status(500).json({ error: 'Failed to fetch member analytics' });
  }
});

// Test endpoint to check if the route is working
router.get('/test', (req, res) => {
  res.json({ message: 'MemberCommitments route is working!' });
});

module.exports = router; 