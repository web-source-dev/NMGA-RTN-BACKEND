const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Commitment = require('../../models/Commitments');
const Deal = require('../../models/Deals');
const crypto = require('crypto');
const sendEmail = require('../../utils/email');
const invitationEmail = require('../../utils/EmailTemplates/InvitationEmail');
const jwt = require('jsonwebtoken');
const { isMemberAdmin, getCurrentUserContext } = require('../../middleware/auth');
const { generateUniqueLoginKey } = require('../../utils/loginKeyGenerator');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');

// Route to add a new member - accessible by member or admin impersonating member
router.post('/add', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const parentUserId = currentUser.id;
    
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

    
    // Check if parent user exists
    const parentUser = await User.findById(parentUserId);
    if (!parentUser) {
      return res.status(404).json({ success: false, message: 'Parent user not found' });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }
    
    // Check if email exists as a collaborator
    const userWithCollaborator = await User.findOne({
      'collaborators.email': email.toLowerCase()
    });
    if (userWithCollaborator) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    // Generate reset token for password creation
    const token = crypto.randomBytes(20).toString('hex');
    const resetPasswordExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const loginKey = await generateUniqueLoginKey(User);
    
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
      addedBy: parentUserId,
      login_key: loginKey,
      teamOwner: null, // Set as main owner since they are added directly
      teamRole: 'member_owner'
    });
    newUser.login_key = loginKey;

    await newUser.save();
    
    // Update parent user's addedMembers array
    await User.findByIdAndUpdate(
      parentUserId,
      { $push: { addedMembers: newUser._id } }
    );
    
    // Send invitation email
    const emailContent = invitationEmail(token, parentUser.name);
    await sendEmail(newUser.email, 'Welcome to NMGA - Complete Your Registration', emailContent);
    
    // Log the action
    await logCollaboratorAction(req, 'add_new_member', 'member', { 
      newMemberId: newUser._id,
      newMemberName: name,
      newMemberEmail: email,
      businessName: businessName,
      contactPerson: contactPerson,
      phone: phone,
      additionalInfo: `Added new member: ${name} (${email})`
    });
    
    res.status(201).json({
      success: true,
      message: 'Member added successfully and invitation sent',
      userId: newUser._id
    });
    
  } catch (error) {
    console.error('Error adding member:', error);
    
    // Log the error
    await logError(req, 'add_new_member', 'member', error, {
      memberEmail: req.body.email,
      memberName: req.body.name
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add member', 
      error: error.message 
    });
  }
});

// Route to get all members added by the current user - accessible by member or admin impersonating member
router.get('/members', isMemberAdmin, async (req, res) => {
  try {
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const parentUserId = currentUser.id;
    
    const parentUser = await User.findById(parentUserId)
      .populate('addedMembers', 'name email businessName phone address _id login_key')
      .select('addedMembers');
    
    if (!parentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    await logCollaboratorAction(req, 'view_added_members', 'members', { 
      totalMembers: parentUser.addedMembers.length,
      additionalInfo: `Viewed ${parentUser.addedMembers.length} added members`
    });
    
    res.status(200).json({
      success: true,
      members: parentUser.addedMembers
    });
    
  } catch (error) {
    console.error('Error fetching added members:', error);
    await logError(req, 'view_added_members', 'members', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch members', 
      error: error.message 
    });
  }
});

// Route to get a specific member's details including commitments - accessible by member or admin impersonating member
router.get('/member-details/:memberId', isMemberAdmin, async (req, res) => {
  try {
    console.log('Member details route called with params:', req.params);
    const { currentUser, originalUser, isImpersonating } = getCurrentUserContext(req);
    const parentUserId = currentUser.id;
    const { memberId } = req.params;
    
    console.log('Current user ID:', parentUserId);
    console.log('Member ID to fetch:', memberId);
    console.log('Is impersonating:', isImpersonating);
    
    // First, verify this member was added by the parent
    const member = await User.findById(memberId);
    
    if (!member) {
      console.log('Member not found with ID:', memberId);
      return res.status(404).json({ 
        success: false, 
        message: 'Member not found' 
      });
    }
    
    console.log('Found member:', member.name, 'Added by:', member.addedBy);
    
    // Check if the requested member was actually added by this parent
    // Convert both ObjectIds to strings for proper comparison
    const memberAddedBy = member.addedBy ? member.addedBy.toString() : null;
    const currentUserIdStr = parentUserId.toString();
    
    console.log('Member added by (string):', memberAddedBy);
    console.log('Current user ID (string):', currentUserIdStr);
    
    if (member.addedBy && memberAddedBy !== currentUserIdStr) {
      console.log('Permission denied: Member added by', memberAddedBy, 'but current user is', currentUserIdStr);
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
    
    console.log('Found commitments:', commitments.length);
    
    // Get summary statistics
    const totalCommitments = commitments.length;
    const totalSpent = commitments.reduce((total, commitment) => 
      total + (commitment.paymentStatus === 'paid' ? commitment.totalPrice : 0), 0);
    const pendingCommitments = commitments.filter(c => c.status === 'pending').length;
    const approvedCommitments = commitments.filter(c => c.status === 'approved').length;
    
    const response = {
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
    };
    
    await logCollaboratorAction(req, 'view_member_details', 'member');
    
    console.log('Sending response with member:', response.member.name);
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error fetching member details:', error);
    await logError(req, 'view_member_details', 'member', error, {
      memberId: req.params.memberId
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch member details', 
      error: error.message 
    });
  }
});

module.exports = router;
