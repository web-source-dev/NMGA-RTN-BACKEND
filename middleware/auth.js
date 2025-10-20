const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Basic authentication middleware - checks if user is authenticated
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        success: false 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found.',
        success: false 
      });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ 
        message: 'User is blocked.',
        success: false 
      });
    }

    // If admin is logged in as another user, set the impersonated user info
    if (decoded.impersonatedUserId) {
      const impersonatedUser = await User.findById(decoded.impersonatedUserId);
      if (impersonatedUser) {
        // Set the impersonated user as the current user
        req.user = {
          id: impersonatedUser._id,
          role: impersonatedUser.role,
          email: impersonatedUser.email,
          name: impersonatedUser.name
        };
        
        // Handle admin impersonation
        if (decoded.adminId) {
          const adminUser = await User.findById(decoded.adminId);
          if (adminUser) {
            req.originalUser = {
              id: adminUser._id,
              role: adminUser.role,
              email: adminUser.email,
              name: adminUser.name
            };
          }
          req.adminId = decoded.adminId;
          req.impersonationType = 'admin';
        }
        
        // Handle parent member impersonation
        if (decoded.parentUserId) {
          const parentUser = await User.findById(decoded.parentUserId);
          if (parentUser) {
            req.originalUser = {
              id: parentUser._id,
              role: parentUser.role,
              email: parentUser.email,
              name: parentUser.name
            };
          }
          req.parentUserId = decoded.parentUserId;
          req.impersonationType = 'member';
        }
        
        req.impersonatedUser = {
          id: impersonatedUser._id,
          role: impersonatedUser.role,
          email: impersonatedUser.email,
          name: impersonatedUser.name
        };
      }
    } else {
      // Regular login - set user info in request
      req.user = {
        id: user._id,
        role: user.role,
        email: user.email,
        name: user.name
      };
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ 
      message: 'Invalid token.',
      success: false 
    });
  }
};

// Admin only middleware
const isAdmin = async (req, res, next) => {
  try {
    // Call isAuthenticated and wait for it to complete
    await new Promise((resolve, reject) => {
      isAuthenticated(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Admin privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Distributor and Admin access middleware
const isDistributorAdmin = async (req, res, next) => {
  try {
    // Call isAuthenticated and wait for it to complete
    await new Promise((resolve, reject) => {
      isAuthenticated(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if this is an impersonation scenario
    if (req.impersonatedUser) {
      // Admin is impersonating another user
      if (req.impersonatedUser.role === 'distributor') {
        req.currentUser = req.impersonatedUser;
        req.isImpersonating = true;
        next();
        return;
      } else {
        // Admin is impersonating a non-distributor user
        return res.status(403).json({ 
          message: 'Access denied. Distributor privileges required.',
          success: false 
        });
      }
    }
    
    // Regular access - user must be distributor or admin
    if (req.user.role !== 'distributor' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Distributor or Admin privileges required.',
        success: false 
      });
    }

    req.currentUser = req.user;
    req.isImpersonating = false;
    next();
  } catch (error) {
    console.error('Distributor/Admin authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Member and Admin access middleware
const isMemberAdmin = async (req, res, next) => {
  try {
    // Call isAuthenticated and wait for it to complete
    await new Promise((resolve, reject) => {
      isAuthenticated(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if this is an impersonation scenario
    if (req.impersonatedUser) {
      // Admin is impersonating another user
      if (req.impersonatedUser.role === 'member') {
        req.currentUser = req.impersonatedUser;
        req.isImpersonating = true;
        next();
        return;
      } else {
        // Admin is impersonating a non-member user
        return res.status(403).json({ 
          message: 'Access denied. Member privileges required.',
          success: false 
        });
      }
    }
    
    // Regular access - user must be member or admin
    if (req.user.role !== 'member' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Access denied. Member or Admin privileges required.',
        success: false 
      });
    }

    req.currentUser = req.user;
    req.isImpersonating = false;
    next();
  } catch (error) {
    console.error('Member/Admin authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Get current user context (useful for determining if admin is impersonating)
const getCurrentUserContext = (req) => {
  if (req.impersonatedUser) {
    // When admin or parent member is impersonating, we need to get the original user's info
    return {
      currentUser: req.impersonatedUser,
      originalUser: req.originalUser || req.user, // Use originalUser if available (admin or parent info)
      isImpersonating: true,
      adminId: req.adminId,
      parentUserId: req.parentUserId,
      impersonationType: req.impersonationType || (req.adminId ? 'admin' : 'member')
    };
  }
  
  return {
    currentUser: req.user,
    isImpersonating: false
  };
};

// Collaborator middleware - checks if user is a collaborator
const isCollaborator = async (req, res, next) => {
  try {
    // Call isAuthenticated and wait for it to complete
    await new Promise((resolve, reject) => {
      isAuthenticated(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Check if this is a collaborator login
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        success: false 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.isCollaborator) {
      return res.status(403).json({ 
        message: 'Access denied. Collaborator privileges required.',
        success: false 
      });
    }

    // Set collaborator context
    req.isCollaborator = true;
    req.collaboratorId = decoded.collaboratorId;
    req.collaboratorRole = decoded.collaboratorRole;
    req.collaboratorEmail = decoded.collaboratorEmail;
    
    next();
  } catch (error) {
    console.error('Collaborator authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Collaborator Manager middleware - checks if user has manager role
const isCollaboratorManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Collaborator Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Deal Manager middleware - checks if user has deal_manager role
const isDealManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'deal_manager' && req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Deal Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Deal Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Supplier Manager middleware - checks if user has supplier_manager role
const isSupplierManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'supplier_manager' && req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Supplier Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Supplier Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Media Manager middleware - checks if user has media_manager role
const isMediaManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'media_manager' && req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Media Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Media Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Commitment Manager middleware - checks if user has commitment_manager role
const isCommitmentManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'commitment_manager' && req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Commitment Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Commitment Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Substore Manager middleware - checks if user has substore_manager role
const isSubstoreManager = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    if (req.collaboratorRole !== 'substore_manager' && req.collaboratorRole !== 'manager') {
      return res.status(403).json({ 
        message: 'Access denied. Substore Manager privileges required.',
        success: false 
      });
    }

    next();
  } catch (error) {
    console.error('Substore Manager authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Viewer middleware - checks if user has at least viewer role (any collaborator)
const isCollaboratorViewer = async (req, res, next) => {
  try {
    // Call isCollaborator and wait for it to complete
    await new Promise((resolve, reject) => {
      isCollaborator(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Any collaborator role is allowed (viewer, manager, deal_manager, etc.)
    next();
  } catch (error) {
    console.error('Collaborator Viewer authentication error:', error);
    return res.status(401).json({ 
      message: 'Authentication failed.',
      success: false 
    });
  }
};

// Helper function to check if collaborator has specific role
const hasCollaboratorRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      // Call isCollaborator and wait for it to complete
      await new Promise((resolve, reject) => {
        isCollaborator(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      
      if (!roles.includes(req.collaboratorRole)) {
        return res.status(403).json({ 
          message: `Access denied. Required roles: ${roles.join(', ')}`,
          success: false 
        });
      }

      next();
    } catch (error) {
      console.error('Role check authentication error:', error);
      return res.status(401).json({ 
        message: 'Authentication failed.',
        success: false 
      });
    }
  };
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isDistributorAdmin,
  isMemberAdmin,
  getCurrentUserContext,
  // Collaborator middlewares
  isCollaborator,
  isCollaboratorManager,
  isDealManager,
  isSupplierManager,
  isMediaManager,
  isCommitmentManager,
  isSubstoreManager,
  isCollaboratorViewer,
  hasCollaboratorRole
};
