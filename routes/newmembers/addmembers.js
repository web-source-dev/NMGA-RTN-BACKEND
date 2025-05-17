const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');
const crypto = require('crypto');
const sendEmail = require('../../utils/email');
const invitationEmail = require('../../utils/EmailTemplates/InvitationEmail');
const jwt = require('jsonwebtoken');

// Route to add a new member
router.post('/add', async (req, res) => {
  try {
    const { 
      name, 
      email, 
      businessName, 
      contactPerson,
      phone, 
      address,
      additionalEmails,
      additionalPhoneNumbers
    } = req.body;

    console.log("Received request body:", req.body);
    // Get the parent user ID from the request
    const parentUserId = req.body.parentUserId;
    
    // Check if parent user exists
    const parentUser = await User.findById(parentUserId);
    console.log("Parent user:", parentUser);
    if (!parentUser) {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    
    // Generate reset token for password creation
    const token = crypto.randomBytes(20).toString('hex');
    const resetPasswordExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Create new user with parent reference
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      businessName,
      contactPerson,
      phone,
      address,
      additionalEmails,
      additionalPhoneNumbers,
      role: 'member', // Default role for added members
      resetPasswordToken: token,
      resetPasswordExpires,
      addedBy: parentUserId
    });
    
    await newUser.save();
    
    // Update parent user's addedMembers array
    await User.findByIdAndUpdate(
      parentUserId,
      { $push: { addedMembers: newUser._id } }
    );
    
    // Send invitation email
    const emailContent = invitationEmail(token, parentUser.name);
    await sendEmail(newUser.email, 'Welcome to NMGA - Complete Your Registration', emailContent);
    
    res.status(201).json({
      success: true,
      message: 'Member added successfully and invitation sent',
      userId: newUser._id
    });
    
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add member', 
      error: error.message 
    });
  }
});

// Route to get all members added by a specific user
router.get('/members/:userId', async (req, res) => {
  try {
    const parentUserId = req.params.userId;
    
    const parentUser = await User.findById(parentUserId)
      .populate('addedMembers', 'name email businessName phone address _id')
      .select('addedMembers');
    
    if (!parentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      members: parentUser.addedMembers
    });
    
  } catch (error) {
    console.error('Error fetching added members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch members', 
      error: error.message 
    });
  }
});

// Route to get a specific member's details including commitments
router.get('/member-details/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { parentId } = req.query; // The parent user making the request
    
    // First, verify this member was added by the parent
    const member = await User.findById(memberId);
    
    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }
    
    // Check if the requested member was actually added by this parent
    if (member.addedBy && member.addedBy.toString() !== parentId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this member'
      });
    }
    
    // Fetch member's commitments with populated deal information
    const commitments = await Commitment.find({ userId: memberId })
      .populate({
        path: 'dealId',
        select: 'name description category images distributor',
        populate: {
          path: 'distributor',
          select: 'name businessName'
        }
      })
      .sort({ createdAt: -1 });
    
    // Get summary statistics
    const totalCommitments = commitments.length;
    const totalSpent = commitments.reduce((total, commitment) => 
      total + (commitment.paymentStatus === 'paid' ? commitment.totalPrice : 0), 0);
    const pendingCommitments = commitments.filter(c => c.status === 'pending').length;
    const approvedCommitments = commitments.filter(c => c.status === 'approved').length;
    
    res.status(200).json({
      success: true,
      member: {
        _id: member._id,
        name: member.name,
        email: member.email,
        businessName: member.businessName,
        phone: member.phone,
        address: member.address,
        addedBy: member.addedBy,
        isVerified: member.isVerified,
        createdAt: member.createdAt
      },
      commitments,
      stats: {
        totalCommitments,
        totalSpent,
        pendingCommitments,
        approvedCommitments
      }
    });
    
  } catch (error) {
    console.error('Error fetching member details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch member details', 
      error: error.message 
    });
  }
});

module.exports = router;
