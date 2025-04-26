const express = require("express");
const router = express.Router();
const Supplier = require("../../models/Suppliers");
const User = require("../../models/User");
const Commitment = require("../../models/Commitments");
const Deal = require("../../models/Deals");

// Get all suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await Supplier.find()
      .populate("assignedTo", "name businessName email")
      .populate("assignedBy", "name businessName email");
    res.status(200).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching suppliers",
      error: error.message,
    });
  }
});

// Get all suppliers assigned by a specific distributor
router.get("/by-distributor/:distributorId", async (req, res) => {
  try {
    const { distributorId } = req.params;
    const suppliers = await Supplier.find({ assignedBy: distributorId })
      .populate("assignedTo", "name businessName email")
      .populate("assignedBy", "name businessName email");
    res.status(200).json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching suppliers by distributor",
      error: error.message,
    });
  }
});

// Create a new supplier
router.post("/", async (req, res) => {
  try {
    const { name, email, distributorId } = req.body;
    
    // Check if supplier with this email already exists for this distributor
    const existingSupplier = await Supplier.findOne({ 
      email,
      assignedBy: distributorId 
    });
    
    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        message: "A supplier with this email already exists for your account",
      });
    }
    
    const newSupplier = new Supplier({ 
      name, 
      email,
      assignedBy: distributorId 
    });
    
    await newSupplier.save();
    
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier: newSupplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating supplier",
      error: error.message,
    });
  }
});

// Assign supplier to a member
router.put("/assign/:supplierId", async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { memberId, distributorId, multiMemberAssignment } = req.body;
    
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }
    
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    
    const distributor = await User.findById(distributorId);
    if (!distributor || distributor.role !== "distributor") {
      return res.status(404).json({
        success: false,
        message: "Distributor not found or invalid role",
      });
    }
    
    // Check if this member is already assigned to this supplier
    if (supplier.assignedTo && supplier.assignedTo.includes(memberId)) {
      return res.status(400).json({
        success: false,
        message: "This member is already assigned to this supplier",
      });
    }
    
    // Initialize assignedTo as an array if it doesn't exist
    if (!supplier.assignedTo) {
      supplier.assignedTo = [];
    }
    
    // Add the member to the assignedTo array
    supplier.assignedTo.push(memberId);
    
    // Set the distributor if not already set
    if (!supplier.assignedBy) {
      supplier.assignedBy = distributorId;
    }
    
    supplier.assignedAt = Date.now();
    
    await supplier.save();
    
    res.status(200).json({
      success: true,
      message: "Supplier assigned successfully",
      supplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error assigning supplier",
      error: error.message,
    });
  }
});

// Remove supplier assignment for a specific member
router.put("/unassign/:supplierId", async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { memberId, distributorId } = req.body;
    
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }
    
    // Check if supplier is assigned to this distributor
    if (supplier.assignedBy.toString() !== distributorId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to unassign this supplier",
      });
    }
    
    // Remove specific member from assignedTo array
    if (supplier.assignedTo && supplier.assignedTo.length > 0) {
      supplier.assignedTo = supplier.assignedTo.filter(
        id => id.toString() !== memberId
      );
    }
    
    await supplier.save();
    
    res.status(200).json({
      success: true,
      message: "Supplier unassigned successfully from member",
      supplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error unassigning supplier",
      error: error.message,
    });
  }
});

// Get members who have committed to a distributor's deals
router.get("/committed-members/:distributorId", async (req, res) => {
  try {
    const { distributorId } = req.params;
    const { month, year } = req.query; // Add month and year query parameters
    
    // Find all deals by this distributor
    const deals = await Deal.find({ distributor: distributorId });
    const dealIds = deals.map(deal => deal._id);
    
    // Base query for commitments
    let commitmentsQuery = {
      dealId: { $in: dealIds }
    };
    
    // Add date filtering if month and year are provided
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0); // Last day of the month
      
      commitmentsQuery.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    // Find all commitments for these deals with optional date filtering
    const commitments = await Commitment.find(commitmentsQuery)
    .populate("userId", "name email businessName phone address")
    .populate({
      path: "dealId",
      select: "name description category images",
      populate: {
        path: "distributor",
        select: "name businessName"
      }
    });
    
    // Group commitments by user
    const userCommitments = {};
    commitments.forEach(commitment => {
      const userId = commitment.userId._id.toString();
      if (!userCommitments[userId]) {
        userCommitments[userId] = {
          user: commitment.userId,
          commitments: [],
          totalSpent: 0,
          dealCount: 0
        };
      }
      
      userCommitments[userId].commitments.push(commitment);
      userCommitments[userId].totalSpent += commitment.totalPrice;
      userCommitments[userId].dealCount += 1;
    });
    
    // Convert to array and get assigned suppliers
    const members = await Promise.all(
      Object.values(userCommitments).map(async (item) => {
        // Find suppliers where this member is in the assignedTo array
        const assignedSupplier = await Supplier.findOne({ 
          assignedTo: { $in: [item.user._id] },
          assignedBy: distributorId
        });
        
        return {
          ...item,
          supplier: assignedSupplier || null
        };
      })
    );
    
    res.status(200).json({
      success: true,
      members
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching committed members",
      error: error.message,
    });
  }
});

// Get member commitment data for export
router.get("/export-member-data/:memberId/:distributorId", async (req, res) => {
  try {
    const { memberId, distributorId } = req.params;
    
    // Find all deals by this distributor
    const deals = await Deal.find({ distributor: distributorId });
    const dealIds = deals.map(deal => deal._id);
    
    // Find all commitments by this member for these deals
    const commitments = await Commitment.find({
      userId: memberId,
      dealId: { $in: dealIds }
    })
    .populate("userId", "name email businessName phone address")
    .populate({
      path: "dealId",
      select: "name description category images sizes",
      populate: {
        path: "distributor",
        select: "name businessName contactPerson phone email"
      }
    });
    
    const user = await User.findById(memberId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Member not found"
      });
    }
    
    // Find supplier where this member is in the assignedTo array
    const supplier = await Supplier.findOne({
      assignedTo: { $in: [memberId] },
      assignedBy: distributorId
    });
    
    const exportData = {
      member: {
        id: user._id,
        name: user.name,
        businessName: user.businessName,
        email: user.email,
        phone: user.phone,
        address: user.address
      },
      supplier: supplier ? {
        id: supplier._id,
        name: supplier.name,
        email: supplier.email
      } : null,
      commitments: commitments.map(c => ({
        id: c._id,
        dealName: c.dealId.name,
        dealDescription: c.dealId.description,
        category: c.dealId.category,
        sizeCommitments: c.sizeCommitments,
        totalPrice: c.totalPrice,
        status: c.status,
        createdAt: c.createdAt
      })),
      summary: {
        totalDeals: commitments.length,
        totalSpent: commitments.reduce((sum, c) => sum + c.totalPrice, 0)
      }
    };
    
    res.status(200).json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error exporting member data",
      error: error.message,
    });
  }
});

// Get all members assigned to a supplier for export
router.get("/export-supplier-data/:supplierId/:distributorId", async (req, res) => {
  try {
    const { supplierId, distributorId } = req.params;
    
    const supplier = await Supplier.findById(supplierId)
      .populate("assignedTo", "name email businessName phone address");
      
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found"
      });
    }
    
    // Check if supplier is assigned to this distributor
    if (supplier.assignedBy.toString() !== distributorId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this supplier's data",
      });
    }
    
    const memberIds = supplier.assignedTo.map(member => member._id);
    
    // Find all deals by this distributor
    const deals = await Deal.find({ distributor: distributorId });
    const dealIds = deals.map(deal => deal._id);
    
    // Find all commitments by these members for these deals
    const commitments = await Commitment.find({
      userId: { $in: memberIds },
      dealId: { $in: dealIds }
    })
    .populate("userId", "name email businessName phone address")
    .populate({
      path: "dealId",
      select: "name description category images sizes",
      populate: {
        path: "distributor",
        select: "name businessName contactPerson phone email"
      }
    });
    
    // Group commitments by member
    const memberData = {};
    commitments.forEach(commitment => {
      const userId = commitment.userId._id.toString();
      if (!memberData[userId]) {
        memberData[userId] = {
          member: {
            id: commitment.userId._id,
            name: commitment.userId.name,
            businessName: commitment.userId.businessName,
            email: commitment.userId.email,
            phone: commitment.userId.phone,
            address: commitment.userId.address
          },
          commitments: [],
          summary: {
            totalDeals: 0,
            totalSpent: 0
          }
        };
      }
      
      memberData[userId].commitments.push({
        id: commitment._id,
        dealName: commitment.dealId.name,
        dealDescription: commitment.dealId.description,
        category: commitment.dealId.category,
        sizeCommitments: commitment.sizeCommitments,
        totalPrice: commitment.totalPrice,
        status: commitment.status,
        createdAt: commitment.createdAt
      });
      
      memberData[userId].summary.totalDeals += 1;
      memberData[userId].summary.totalSpent += commitment.totalPrice;
    });
    
    // Add members who have no commitments yet
    supplier.assignedTo.forEach(member => {
      const userId = member._id.toString();
      if (!memberData[userId]) {
        memberData[userId] = {
          member: {
            id: member._id,
            name: member.name,
            businessName: member.businessName,
            email: member.email,
            phone: member.phone,
            address: member.address
          },
          commitments: [],
          summary: {
            totalDeals: 0,
            totalSpent: 0
          }
        };
      }
    });
    
    const exportData = {
      supplier: {
        id: supplier._id,
        name: supplier.name,
        email: supplier.email
      },
      members: Object.values(memberData),
      summary: {
        totalMembers: Object.keys(memberData).length,
        totalCommitments: commitments.length,
        totalValue: commitments.reduce((sum, c) => sum + c.totalPrice, 0)
      }
    };
    
    res.status(200).json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error exporting supplier data",
      error: error.message,
    });
  }
});

module.exports = router;
