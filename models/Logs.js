const mongoose = require('mongoose');

// Define the schema for logs
const logSchema = new mongoose.Schema({
    // Legacy field - kept for backward compatibility
    message: {
        type: String,
        required: true
    },
    
    // Log classification
    type: {
        type: String,
        enum: ['info', 'success', 'error', 'warning'],
        required: true
    },
    
    // Action information
    action: {
        type: String,
        required: true,
        index: true // For faster querying
    },
    
    resource: {
        type: String, // e.g., 'deal', 'commitment', 'user', 'supplier'
        index: true
    },
    
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true // For tracking specific resources
    },
    
    resourceName: {
        type: String // Human-readable resource name
    },
    
    // User information
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    
    userName: {
        type: String // Cached for faster display
    },
    
    userEmail: {
        type: String // Cached for faster display
    },
    
    userRole: {
        type: String,
        enum: ['admin', 'distributor', 'member', 'manager', 'deal_manager', 'supplier_manager', 
               'media_manager', 'commitment_manager', 'substore_manager', 'viewer']
    },
    
    // Collaborator information (if action performed by collaborator)
    isCollaborator: {
        type: Boolean,
        default: false
    },
    
    collaborator: {
        id: String,
        name: String,
        email: String,
        role: String
    },
    
    // Impersonation information (if admin is impersonating)
    isImpersonating: {
        type: Boolean,
        default: false
    },
    
    impersonation: {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        adminName: String,
        impersonatedUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        impersonatedUserName: String
    },
    
    // Request metadata
    requestInfo: {
        ipAddress: String,
        userAgent: String,
        method: String, // GET, POST, PUT, DELETE
        endpoint: String, // API endpoint
        statusCode: Number
    },
    
    // Additional context and metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Flexible object for additional data
        default: {}
    },
    
    // Performance tracking
    duration: {
        type: Number, // Milliseconds
        default: null
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['success', 'failure', 'pending'],
        default: 'success'
    },
    
    errorDetails: {
        errorMessage: String,
        errorStack: String,
        errorCode: String
    },
    
    // Before/after state for updates (optional)
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed
    },
    
    // Tags for categorization
    tags: [{
        type: String
    }],
    
    // Session information
    sessionId: String,
    
    // Severity level
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
    }
}, {
    timestamps: true,
});

// Indexes for efficient querying
logSchema.index({ createdAt: -1 }); // Most recent logs first
logSchema.index({ user_id: 1, createdAt: -1 }); // User's logs
logSchema.index({ action: 1, createdAt: -1 }); // Actions timeline
logSchema.index({ resource: 1, resourceId: 1 }); // Resource-specific logs
logSchema.index({ type: 1, severity: 1 }); // Filter by type and severity
logSchema.index({ 'requestInfo.ipAddress': 1 }); // Track by IP
logSchema.index({ tags: 1 }); // Filter by tags

// Virtual for duration in seconds
logSchema.virtual('durationSeconds').get(function() {
    return this.duration ? this.duration / 1000 : null;
});

// Method to check if log is from collaborator
logSchema.methods.isCollaboratorAction = function() {
    return this.isCollaborator === true;
};

// Method to check if log is from impersonation
logSchema.methods.isImpersonationAction = function() {
    return this.isImpersonating === true;
};

// Static method to get logs by date range
logSchema.statics.getLogsByDateRange = function(startDate, endDate, filter = {}) {
    return this.find({
        createdAt: {
            $gte: startDate,
            $lte: endDate
        },
        ...filter
    }).sort({ createdAt: -1 });
};

// Static method to get logs by user
logSchema.statics.getUserLogs = function(userId, limit = 100) {
    return this.find({ user_id: userId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get logs by action
logSchema.statics.getLogsByAction = function(action, limit = 100) {
    return this.find({ action })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get error logs
logSchema.statics.getErrorLogs = function(limit = 100) {
    return this.find({ 
        $or: [
            { type: 'error' },
            { status: 'failure' },
            { severity: { $in: ['high', 'critical'] } }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Create the model from the schema
module.exports = mongoose.model('Log', logSchema);
