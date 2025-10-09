const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../../models/User');
const { isAuthenticated } = require('../../middleware/auth');
const { logCollaboratorAction, logError } = require('../../utils/collaboratorLogger');
const sendEmail = require('../../utils/email');
const collaboratorCredentialsTemplate = require('../../utils/EmailTemplates/collaboratorCredentialsTemplate');

// Get all collaborators for the current user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('collaborators');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log the action
    await logCollaboratorAction(req, 'view_collaborators', 'collaborators list');

    res.json(user.collaborators || []);
  } catch (error) {
    console.error('Error fetching collaborators:', error);
    await logError(req, 'view_collaborators', 'collaborators list', error);
    res.status(500).json({ message: 'Error fetching collaborators' });
  }
});

// Add a new collaborator
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !email || !role || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if email already exists in main User model
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists in the system' });
    }

    // Check if email already exists as collaborator for this user
    const currentUser = await User.findById(userId);
    const existingCollaborator = currentUser.collaborators.find(
      collab => collab.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingCollaborator) {
      return res.status(400).json({ message: 'Email already exists as a collaborator' });
    }

    // Validate role based on user's role
    const validRoles = getValidRolesForUser(req.user.role);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        message: 'Invalid role for your account type',
        validRoles 
      });
    }

    // Store original password for email before hashing
    const originalPassword = password;
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiry = new Date();
    invitationExpiry.setDate(invitationExpiry.getDate() + 7); // 7 days expiry

    // Determine roleSet based on role
    const getRoleSetForRole = (role) => {
      if (['manager', 'deal_manager', 'commitment_manager'].includes(role)) {
        return 2;
      }
      return 3;
    };

    // Create new collaborator
    const newCollaborator = {
      name,
      email: email.toLowerCase(),
      role,
      roleSet: getRoleSetForRole(role),
      password: hashedPassword,
      status: 'active',
      invitationToken,
      invitationExpiry
    };

    // Add collaborator to user's collaborators array
    currentUser.collaborators.push(newCollaborator);
    await currentUser.save();

    const businessName = currentUser.businessName;

    // Send email to collaborator with credentials
    try {
      const emailContent = collaboratorCredentialsTemplate(
        name, 
        email, 
        businessName, 
        originalPassword, 
        role, 
        currentUser.name
      );
      
      await sendEmail(email, `NMGA - Staff Member at ${businessName}`, emailContent);
      console.log(`✅ Collaborator credentials email sent to: ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send collaborator credentials email to ${email}:`, emailError.message);
      // Don't fail the request if email fails, just log the error
    }

    // Return the collaborator without password
    const collaboratorResponse = {
      ...newCollaborator,
      password: undefined
    };

    // Log the action
    await logCollaboratorAction(req, 'add_collaborator', 'collaborator', {
      collaboratorName: name,
      collaboratorRole: role,
      collaboratorEmail: email
    });

    res.status(201).json({
      message: 'Collaborator added successfully',
      collaborator: collaboratorResponse
    });
  } catch (error) {
    console.error('Error adding collaborator:', error);
    await logError(req, 'add_collaborator', 'collaborator', error, {
      collaboratorName: req.body.name,
      collaboratorRole: req.body.role,
      collaboratorEmail: req.body.email
    });
    res.status(500).json({ message: 'Error adding collaborator' });
  }
});

// Update a collaborator
router.put('/:collaboratorId', isAuthenticated, async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    const { name, email, role, password } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the collaborator
    const collaborator = user.collaborators.id(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Check if email is being changed and if it already exists
    if (email && email.toLowerCase() !== collaborator.email.toLowerCase()) {
      // Check if email exists in main User model
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists in the system' });
      }

      // Check if email exists as another collaborator
      const existingCollaborator = user.collaborators.find(
        collab => collab.email.toLowerCase() === email.toLowerCase() && 
                 collab._id.toString() !== collaboratorId
      );
      
      if (existingCollaborator) {
        return res.status(400).json({ message: 'Email already exists as a collaborator' });
      }
    }

    // Validate role if being changed
    if (role && role !== collaborator.role) {
      const validRoles = getValidRolesForUser(req.user.role);
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          message: 'Invalid role for your account type',
          validRoles 
        });
      }
    }

    // Update collaborator fields
    if (name) collaborator.name = name;
    if (email) collaborator.email = email.toLowerCase();
    if (role) {
      collaborator.role = role;
      // Update roleSet when role changes
      const getRoleSetForRole = (role) => {
        if (['manager', 'deal_manager', 'commitment_manager'].includes(role)) {
          return 2;
        }
        return 3;
      };
      collaborator.roleSet = getRoleSetForRole(role);
    }
    
    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      collaborator.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Return updated collaborator without password
    const collaboratorResponse = {
      ...collaborator.toObject(),
      password: undefined
    };

    // Log the action
    await logCollaboratorAction(req, 'update_collaborator', 'collaborator', {
      collaboratorName: collaborator.name,
      collaboratorRole: collaborator.role,
      collaboratorEmail: collaborator.email
    });

    res.json({
      message: 'Collaborator updated successfully',
      collaborator: collaboratorResponse
    });
  } catch (error) {
    console.error('Error updating collaborator:', error);
    await logError(req, 'update_collaborator', 'collaborator', error, {
      collaboratorId: req.params.collaboratorId
    });
    res.status(500).json({ message: 'Error updating collaborator' });
  }
});

// Delete a collaborator
router.delete('/:collaboratorId', isAuthenticated, async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the collaborator
    const collaborator = user.collaborators.id(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Store collaborator details for logging before deletion
    const collaboratorDetails = {
      name: collaborator.name,
      role: collaborator.role,
      email: collaborator.email
    };

    // Actually remove the collaborator from the array
    user.collaborators.pull(collaboratorId);
    await user.save();

    // Log the action
    await logCollaboratorAction(req, 'delete_collaborator', 'collaborator', collaboratorDetails);

    res.json({ message: 'Collaborator deleted successfully' });
  } catch (error) {
    console.error('Error deleting collaborator:', error);
    await logError(req, 'delete_collaborator', 'collaborator', error, {
      collaboratorId: req.params.collaboratorId
    });
    res.status(500).json({ message: 'Error deleting collaborator' });
  }
});

// Get collaborator by ID
router.get('/:collaboratorId', isAuthenticated, async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const collaborator = user.collaborators.id(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Log the action
    await logCollaboratorAction(req, 'view_collaborator', 'collaborator details', {
      collaboratorName: collaborator.name
    });

    // Return collaborator without password
    const collaboratorResponse = {
      ...collaborator.toObject(),
      password: undefined
    };

    res.json(collaboratorResponse);
  } catch (error) {
    console.error('Error fetching collaborator:', error);
    await logError(req, 'view_collaborator', 'collaborator details', error, {
      collaboratorId: req.params.collaboratorId
    });
    res.status(500).json({ message: 'Error fetching collaborator' });
  }
});

// Activate a collaborator (change status from invited to active)
router.patch('/:collaboratorId/activate', isAuthenticated, async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const collaborator = user.collaborators.id(collaboratorId);
    if (!collaborator) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    if (collaborator.status !== 'invited') {
      return res.status(400).json({ message: 'Collaborator is not in invited status' });
    }

    collaborator.status = 'active';
    await user.save();

    // Log the action
    await logCollaboratorAction(req, 'activate_collaborator', 'collaborator', {
      collaboratorName: collaborator.name,
      collaboratorRole: collaborator.role,
      collaboratorEmail: collaborator.email
    });

    res.json({ 
      message: 'Collaborator activated successfully',
      collaborator: {
        ...collaborator.toObject(),
        password: undefined
      }
    });
  } catch (error) {
    console.error('Error activating collaborator:', error);
    await logError(req, 'activate_collaborator', 'collaborator', error, {
      collaboratorId: req.params.collaboratorId
    });
    res.status(500).json({ message: 'Error activating collaborator' });
  }
});

// Helper function to get valid roles based on user's role
function getValidRolesForUser(userRole) {
  const baseRoles = ['viewer'];
  
  if (userRole === 'distributor') {
    return [
      ...baseRoles,
      'deal_manager',
      'supplier_manager', 
      'media_manager',
      'manager'
    ];
  } else if (userRole === 'member') {
    return [
      ...baseRoles,
      'commitment_manager',
      'substore_manager',
      'manager'
    ];
  }
  
  return baseRoles;
}

module.exports = router;
