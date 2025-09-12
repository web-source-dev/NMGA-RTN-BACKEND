const jwt = require('jsonwebtoken');
const Log = require('../models/Logs');
const User = require('../models/User');
const { isFeatureEnabled } = require('../config/features');

/**
 * Extract comprehensive information from JWT token
 * @param {Object} req - Express request object
 * @returns {Object|null} - Token information or null if invalid
 */
const extractTokenInfo = (req) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return null;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        return {
            // Basic token info
            isValid: true,
            userId: decoded.id,
            userRole: decoded.role,
            
            // Collaborator info (if applicable)
            isCollaborator: decoded.isCollaborator || false,
            collaboratorId: decoded.collaboratorId || null,
            collaboratorRole: decoded.collaboratorRole || null,
            collaboratorEmail: decoded.collaboratorEmail || null,
            
            // Impersonation info (if applicable)
            isImpersonating: decoded.isImpersonating || false,
            impersonatedUserId: decoded.impersonatedUserId || null,
            adminId: decoded.adminId || null,
            
            // Raw decoded token for debugging
            raw: decoded
        };
    } catch (error) {
        console.error('Token extraction error:', error);
        return null;
    }
};

/**
 * Get user-friendly name for a user ID
 * @param {String} userId - User ID
 * @returns {String} - User name or "Unknown User"
 */
const getUserName = async (userId) => {
    try {
        if (!userId) return "Unknown User";
        const user = await User.findById(userId).select('name email');
        return user ? user.name : "Unknown User";
    } catch (error) {
        console.error('Error fetching user name:', error);
        return "Unknown User";
    }
};

/**
 * Get collaborator name from parent user
 * @param {String} parentUserId - Parent user ID
 * @param {String} collaboratorId - Collaborator ID
 * @returns {String} - Collaborator name or "Unknown Collaborator"
 */
const getCollaboratorName = async (parentUserId, collaboratorId) => {
    try {
        if (!parentUserId || !collaboratorId) return "Unknown Collaborator";
        
        const user = await User.findById(parentUserId).select('collaborators');
        if (!user || !user.collaborators) return "Unknown Collaborator";
        
        const collaborator = user.collaborators.find(
            collab => collab._id.toString() === collaboratorId
        );
        
        return collaborator ? collaborator.name : "Unknown Collaborator";
    } catch (error) {
        console.error('Error fetching collaborator name:', error);
        return "Unknown Collaborator";
    }
};

/**
 * Get role display name
 * @param {String} role - Role string
 * @returns {String} - User-friendly role name
 */
const getRoleDisplayName = (role) => {
    const roleMap = {
        'admin': 'Administrator',
        'distributor': 'Distributor',
        'member': 'Member',
        'manager': 'Manager',
        'deal_manager': 'Deal Manager',
        'supplier_manager': 'Supplier Manager',
        'media_manager': 'Media Manager',
        'commitment_manager': 'Commitment Manager',
        'substore_manager': 'Substore Manager',
        'viewer': 'Viewer'
    };
    return roleMap[role] || role;
};

/**
 * Create user-friendly log message based on action type and context
 * @param {String} action - Action performed
 * @param {String} resource - Resource affected
 * @param {Object} context - Additional context
 * @param {Object} tokenInfo - Token information
 * @returns {String} - User-friendly log message
 */
const createLogMessage = async (action, resource, context = {}, tokenInfo) => {
    const { isCollaborator, isImpersonating, userId, collaboratorId, collaboratorRole, adminId } = tokenInfo;
    
    let message = '';
    let actorName = '';
    let actorRole = '';
    
    if (isImpersonating) {
        // Admin impersonating another user
        const adminName = await getUserName(adminId);
        const impersonatedUserName = await getUserName(userId);
        actorName = `${adminName} (impersonating ${impersonatedUserName})`;
        actorRole = 'Administrator';
    } else if (isCollaborator) {
        // Collaborator performing action
        const collaboratorName = await getCollaboratorName(userId, collaboratorId);
        const parentUserName = await getUserName(userId);
        actorName = `${collaboratorName} (${parentUserName}'s ${getRoleDisplayName(collaboratorRole)})`;
        actorRole = getRoleDisplayName(collaboratorRole);
    } else {
        // Regular user performing action
        const userName = await getUserName(userId);
        actorName = userName;
        actorRole = getRoleDisplayName(tokenInfo.userRole);
    }
    
    // Create action-specific messages
    const actionMessages = {
        // Analytics actions
        'view_analytics': `${actorName} viewed analytics dashboard`,
        'view_weekly_metrics': `${actorName} viewed weekly performance metrics`,
        'view_regional_stats': `${actorName} viewed regional statistics`,
        'view_business_types': `${actorName} viewed business type analytics`,
        'view_deal_analytics': `${actorName} viewed deal analytics overview`,
        'view_deal_categories': `${actorName} viewed deal categories statistics`,
        'view_recent_deals': `${actorName} viewed recent deals analytics`,
        
        // Announcement actions
        'create_announcement': `${actorName} created announcement "${context.title || 'Untitled'}"`,
        'update_announcement': `${actorName} updated announcement "${context.title || 'Untitled'}"`,
        'delete_announcement': `${actorName} deleted announcement "${context.title || 'Untitled'}"`,
        'activate_announcement': `${actorName} activated announcement "${context.title || 'Untitled'}"`,
        'deactivate_announcement': `${actorName} deactivated announcement "${context.title || 'Untitled'}"`,
        'view_announcements': `${actorName} viewed announcements`,
        
        // Chat message actions
        'send_message': `${actorName} sent a message in chat`,
        'view_messages': `${actorName} viewed chat messages`,
        'delete_message': `${actorName} deleted a chat message`,
        
        // Collaborator actions
        'add_collaborator': `${actorName} added new collaborator "${context.collaboratorName || 'Unknown'}" with ${getRoleDisplayName(context.collaboratorRole || 'viewer')} role`,
        'update_collaborator': `${actorName} updated collaborator "${context.collaboratorName || 'Unknown'}" information`,
        'delete_collaborator': `${actorName} removed collaborator "${context.collaboratorName || 'Unknown'}"`,
        'activate_collaborator': `${actorName} activated collaborator "${context.collaboratorName || 'Unknown'}"`,
        'view_collaborators': `${actorName} viewed collaborators list`,
        'view_collaborator': `${actorName} viewed collaborator "${context.collaboratorName || 'Unknown'}" details`,
        
        // Commitment actions
        'create_commitment': `${actorName} created a new commitment for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'update_commitment': `${actorName} updated commitment for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'delete_commitment': `${actorName} deleted commitment for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_commitments': `${actorName} viewed commitments list`,
        'view_commitment': `${actorName} viewed commitment details`,
        
        // Generic actions
        'login': `${actorName} logged into the system`,
        'logout': `${actorName} logged out of the system`,
        'view_dashboard': `${actorName} accessed dashboard`,
        'update_profile': `${actorName} updated their profile information`,
        'change_password': `${actorName} changed their password`,
        'reset_password': `${actorName} requested password reset`,
        'verify_email': `${actorName} verified their email address`,
        'block_user': `${actorName} blocked user "${context.targetUserName || 'Unknown'}"`,
        'unblock_user': `${actorName} unblocked user "${context.targetUserName || 'Unknown'}"`,
        'impersonate_user': `${actorName} started impersonating user "${context.targetUserName || 'Unknown'}"`,
        'stop_impersonation': `${actorName} stopped impersonating user`,
        
        // User management actions
        'view_all_users': `${actorName} viewed all users list`,
        'view_user_data': `${actorName} viewed user data`,
        'view_user_profile': `${actorName} viewed user profile`,
        'view_member_profile': `${actorName} viewed member profile`,
        'view_distributor_profile': `${actorName} viewed distributor profile`,
        'create_user': `${actorName} created new user account "${context.targetUserName || 'Unknown'}"`,
        'create_user_failed': `${actorName} failed to create user account`,
        'setup_password': `${actorName} set up password for user account`,
        'setup_password_failed': `${actorName} failed to set up password for user account`,
        'register': `${actorName} registered new account`,
        
        // File operations
        'upload_file': `${actorName} uploaded file "${context.fileName || 'Unknown File'}"`,
        'delete_file': `${actorName} deleted file "${context.fileName || 'Unknown File'}"`,
        'download_file': `${actorName} downloaded file "${context.fileName || 'Unknown File'}"`,
        
        // Deal operations
        'create_deal': `${actorName} created new deal "${context.dealTitle || 'Untitled Deal'}"`,
        'update_deal': `${actorName} updated deal "${context.dealTitle || 'Untitled Deal'}"`,
        'delete_deal': `${actorName} deleted deal "${context.dealTitle || 'Untitled Deal'}"`,
        'view_deal': `${actorName} viewed deal "${context.dealTitle || 'Untitled Deal'}"`,
        'view_all_deals': `${actorName} viewed all deals list`,
        'view_latest_deals': `${actorName} viewed latest deals`,
        'accept_deal': `${actorName} accepted deal "${context.dealTitle || 'Untitled Deal'}"`,
        'decline_deal': `${actorName} declined deal "${context.dealTitle || 'Untitled Deal'}"`,
        
        // Payment operations
        'process_payment': `${actorName} processed payment of $${context.amount || '0.00'} for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_payments': `${actorName} viewed payment history`,
        'refund_payment': `${actorName} issued refund of $${context.amount || '0.00'} for deal "${context.dealTitle || 'Unknown Deal'}"`,
        
        // Notification operations
        'send_notification': `${actorName} sent notification to "${context.recipientName || 'Unknown User'}"`,
        'view_notifications': `${actorName} viewed notifications`,
        'mark_notification_read': `${actorName} marked notification as read`,
        'delete_notification': `${actorName} deleted notification`,
        
        // System operations
        'system_backup': `${actorName} initiated system backup`,
        'system_restore': `${actorName} initiated system restore`,
        'system_maintenance': `${actorName} performed system maintenance`,
        'system_error': `${actorName} encountered a system error`,
        'export_data': `${actorName} exported system data`,
        'import_data': `${actorName} imported data into the system`,
        
        // Log operations
        'view_all_logs': `${actorName} viewed all system logs`,
        'view_user_logs': `${actorName} viewed their user logs`,
        'view_specific_user_logs': `${actorName} viewed logs for specific user`,
        
        // Member management operations
        'view_inactive_members': `${actorName} viewed inactive members report`,
        'view_inactive_members_failed': `${actorName} failed to view inactive members report`,
        'view_blocked_members': `${actorName} viewed blocked members report`,
        'view_blocked_members_failed': `${actorName} failed to view blocked members report`,
        'block_user_failed': `${actorName} failed to block user`,
        'unblock_user_failed': `${actorName} failed to unblock user`,
        
        // Deal operations
        'view_distributor_deals': `${actorName} viewed distributor deals list`,
        'view_admin_all_deals': `${actorName} viewed all deals list`,
        'bulk_approve_commitments': `${actorName} bulk approved commitments for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'bulk_approve_commitments_failed': `${actorName} failed to bulk approve commitments`,
        'bulk_decline_commitments': `${actorName} bulk declined commitments for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'bulk_decline_commitments_failed': `${actorName} failed to bulk decline commitments`,
        'bulk_approve_commitments_admin': `${actorName} (admin) bulk approved commitments for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'bulk_decline_commitments_admin': `${actorName} (admin) bulk declined commitments for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_deal_commitments': `${actorName} viewed commitments for deal`,
        'update_commitment_status': `${actorName} updated commitment status to ${context.status || 'unknown'}`,
        'update_commitment_status_failed': `${actorName} failed to update commitment status`,
        'view_deal_analytics': `${actorName} viewed analytics for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_deal_analytics_failed': `${actorName} failed to view deal analytics`,
        
        // Comparison operations
        'view_comparison_deals': `${actorName} viewed comparison deals`,
        'view_comparison_deals_failed': `${actorName} failed to view comparison deals`,
        'download_comparison_template': `${actorName} downloaded comparison template for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'download_comparison_template_failed': `${actorName} failed to download comparison template`,
        'upload_comparison_data': `${actorName} uploaded comparison data for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'upload_comparison_data_failed': `${actorName} failed to upload comparison data`,
        'view_comparison_details': `${actorName} viewed comparison details`,
        'view_comparison_details_failed': `${actorName} failed to view comparison details`,
        'view_comparison_history': `${actorName} viewed comparison history`,
        'view_comparison_history_failed': `${actorName} failed to view comparison history`,
        
        // Bulk upload operations
        'download_deals_template': `${actorName} downloaded deals template`,
        'bulk_upload_deals': `${actorName} bulk uploaded deals`,
        'bulk_upload_deals_failed': `${actorName} failed to bulk upload deals`,
        'bulk_upload_validation_errors': `${actorName} attempted bulk upload with validation errors`,
        'bulk_upload_no_deals': `${actorName} attempted bulk upload with no valid deals`,
        
        // Chat operations
        'view_chat_messages': `${actorName} viewed chat messages`,
        'send_chat_message': `${actorName} sent a chat message`,
        'mark_messages_read': `${actorName} marked chat messages as read`,
        
        // Commitment operations
        'create_commitment': `${actorName} created commitment for deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_user_commitments': `${actorName} viewed their commitments`,
        
        // Additional deal operations
        'view_available_deals': `${actorName} viewed available deals for purchase`,
        'view_available_deals_failed': `${actorName} failed to view available deals`,
        'view_deal_categories': `${actorName} viewed deal categories`,
        'view_deal_categories_failed': `${actorName} failed to view deal categories`,
        'view_single_deal': `${actorName} viewed deal "${context.dealName || 'Unknown Deal'}"`,
        'view_single_deal_failed': `${actorName} failed to view deal`,
        'view_dashboard_stats': `${actorName} viewed dashboard statistics`,
        'view_dashboard_stats_failed': `${actorName} failed to view dashboard statistics`,
        'view_admin_all_deals_failed': `${actorName} failed to view all deals`,
        'view_distributor_deals_failed': `${actorName} failed to view distributor deals`,
        
        // Member commitment operations
        'view_members_with_commitments': `${actorName} viewed members with commitments`,
        'view_members_with_commitments_failed': `${actorName} failed to view members with commitments`,
        'view_member_details': `${actorName} viewed member details for "${context.memberName || 'Unknown Member'}"`,
        'view_member_details_failed': `${actorName} failed to view member details`,
        'view_member_analytics': `${actorName} viewed member analytics`,
        'view_member_analytics_failed': `${actorName} failed to view member analytics`,
        
        // Recent activity operations
        'view_recent_activity': `${actorName} viewed recent activity data`,
        'view_recent_activity_failed': `${actorName} failed to view recent activity data`,
        
        // Deal commitment operations
        'view_deal_commitments': `${actorName} viewed commitments for deal`,
        'view_deal_commitments_failed': `${actorName} failed to view deal commitments`,
        
        // Top performers operations
        'view_all_distributors': `${actorName} viewed all distributors list`,
        'view_all_distributors_failed': `${actorName} failed to view all distributors`,
        'view_top_distributors': `${actorName} viewed top performing distributors`,
        'view_top_distributors_failed': `${actorName} failed to view top distributors`,
        'view_all_members': `${actorName} viewed all members list`,
        'view_all_members_failed': `${actorName} failed to view all members`,
        'view_member_details_admin': `${actorName} viewed member details (admin)`,
        'view_member_details_admin_failed': `${actorName} failed to view member details (admin)`,
        'view_top_members': `${actorName} viewed top performing members`,
        'view_top_members_failed': `${actorName} failed to view top members`,
        
        // Deal update operations
        'update_deal': `${actorName} updated deal "${context.dealName || 'Unknown Deal'}"`,
        'update_deal_failed': `${actorName} failed to update deal`,
        'update_deal_status': `${actorName} updated deal status to ${context.newStatus || 'unknown'}`,
        'update_deal_status_failed': `${actorName} failed to update deal status`,
        'update_deal_status_admin': `${actorName} (admin) updated deal status to ${context.newStatus || 'unknown'}`,
        'update_deal_status_admin_failed': `${actorName} (admin) failed to update deal status`,
        
        // Media Manager operations
        'view_media_library': `${actorName} viewed media library`,
        'view_media_library_failed': `${actorName} failed to view media library`,
        'view_media_item': `${actorName} viewed media item "${context.mediaName || 'Unknown Media'}"`,
        'view_media_item_failed': `${actorName} failed to view media item`,
        'upload_media': `${actorName} uploaded media "${context.mediaName || 'Unknown Media'}"`,
        'upload_media_failed': `${actorName} failed to upload media`,
        'upload_media_direct': `${actorName} uploaded media directly "${context.mediaName || 'Unknown Media'}"`,
        'upload_media_direct_failed': `${actorName} failed to upload media directly`,
        'update_media': `${actorName} updated media "${context.mediaName || 'Unknown Media'}"`,
        'update_media_failed': `${actorName} failed to update media`,
        'delete_media': `${actorName} deleted media "${context.mediaName || 'Unknown Media'}"`,
        'delete_media_failed': `${actorName} failed to delete media`,
        'create_folder': `${actorName} created folder "${context.folderName || 'Unknown Folder'}"`,
        'create_folder_failed': `${actorName} failed to create folder`,
        'view_folders': `${actorName} viewed folders`,
        'view_folders_failed': `${actorName} failed to view folders`,
        'update_folder': `${actorName} updated folder "${context.folderName || 'Unknown Folder'}"`,
        'update_folder_failed': `${actorName} failed to update folder`,
        'delete_folder': `${actorName} deleted folder "${context.folderName || 'Unknown Folder'}"`,
        'delete_folder_failed': `${actorName} failed to delete folder`,
        'view_media_stats': `${actorName} viewed media statistics`,
        'view_media_stats_failed': `${actorName} failed to view media statistics`,
        
        // Member operations
        'view_member_stats': `${actorName} viewed member statistics`,
        'view_member_stats_failed': `${actorName} failed to view member statistics`,
        'view_member_commitments': `${actorName} viewed member commitments`,
        'view_member_commitments_failed': `${actorName} failed to view member commitments`,
        'view_member_favorites': `${actorName} viewed member favorites`,
        'view_member_favorites_failed': `${actorName} failed to view member favorites`,
        'remove_favorite': `${actorName} removed favorite "${context.dealName || 'Unknown Deal'}"`,
        'remove_favorite_failed': `${actorName} failed to remove favorite`,
        'cancel_commitment': `${actorName} cancelled commitment for "${context.dealName || 'Unknown Deal'}"`,
        'cancel_commitment_failed': `${actorName} failed to cancel commitment`,
        'view_member_analytics': `${actorName} viewed member analytics`,
        'view_member_analytics_failed': `${actorName} failed to view member analytics`,
        'view_user_profile': `${actorName} viewed user profile`,
        'view_user_profile_failed': `${actorName} failed to view user profile`,
        'update_user_profile': `${actorName} updated user profile`,
        'update_user_profile_failed': `${actorName} failed to update user profile`,
        'change_password': `${actorName} changed password`,
        'change_password_failed': `${actorName} failed to change password`,
        'update_user_avatar': `${actorName} updated user avatar`,
        'update_user_avatar_failed': `${actorName} failed to update user avatar`,
        'view_detailed_analytics': `${actorName} viewed detailed analytics`,
        'view_detailed_analytics_failed': `${actorName} failed to view detailed analytics`,
        'modify_commitment_sizes': `${actorName} modified commitment sizes`,
        'modify_commitment_sizes_failed': `${actorName} failed to modify commitment sizes`,
        'access_member_dashboard': `${actorName} accessed member dashboard`,
        'access_member_dashboard_failed': `${actorName} failed to access member dashboard`,
        
        // Add member operations
        'add_new_member': `${actorName} added new member "${context.memberName || 'Unknown Member'}"`,
        'add_new_member_failed': `${actorName} failed to add new member`,
        'view_added_members': `${actorName} viewed added members`,
        'view_added_members_failed': `${actorName} failed to view added members`,
        'view_member_details': `${actorName} viewed member details for "${context.memberName || 'Unknown Member'}"`,
        'view_member_details_failed': `${actorName} failed to view member details`,
        
        // Supplier operations
        'view_suppliers': `${actorName} viewed suppliers`,
        'view_suppliers_failed': `${actorName} failed to view suppliers`,
        'create_supplier': `${actorName} created supplier "${context.supplierName || 'Unknown Supplier'}"`,
        'create_supplier_failed': `${actorName} failed to create supplier`,
        'assign_supplier': `${actorName} assigned supplier "${context.supplierName || 'Unknown Supplier'}" to member "${context.memberName || 'Unknown Member'}"`,
        'assign_supplier_failed': `${actorName} failed to assign supplier`,
        'unassign_supplier': `${actorName} unassigned supplier "${context.supplierName || 'Unknown Supplier'}" from member "${context.memberName || 'Unknown Member'}"`,
        'unassign_supplier_failed': `${actorName} failed to unassign supplier`,
        'view_committed_members': `${actorName} viewed committed members`,
        'view_committed_members_failed': `${actorName} failed to view committed members`,
        'export_member_data': `${actorName} exported member data for "${context.memberName || 'Unknown Member'}"`,
        'export_member_data_failed': `${actorName} failed to export member data`,
        'export_supplier_data': `${actorName} exported supplier data for "${context.supplierName || 'Unknown Supplier'}"`,
        'export_supplier_data_failed': `${actorName} failed to export supplier data`,
        
        // All Member Distributor operations
        'view_distributor_members': `${actorName} viewed distributor members`,
        'view_distributor_members_failed': `${actorName} failed to view distributor members`,
        'view_distributor_member_details': `${actorName} viewed distributor member details for "${context.memberName || 'Unknown Member'}"`,
        'view_distributor_member_details_failed': `${actorName} failed to view distributor member details`,
        'view_distributor_top_members': `${actorName} viewed distributor top members`,
        'view_distributor_top_members_failed': `${actorName} failed to view distributor top members`,
        
        // Contact Us operations
        'update_contact_status': `${actorName} updated contact status to "${context.newStatus || 'unknown'}" for "${context.contactName || 'Unknown Contact'}"`,
        'update_contact_status_failed': `${actorName} failed to update contact status`,
        'submit_contact_form': `${actorName} submitted contact form - Subject: "${context.subject || 'No Subject'}"`,
        'submit_contact_form_failed': `${actorName} failed to submit contact form`,
        'view_all_contacts': `${actorName} viewed all contact form submissions`,
        'view_all_contacts_failed': `${actorName} failed to view all contact form submissions`,
        
        // User operations
        'view_distributor_list': `${actorName} viewed distributor list`,
        'view_distributor_list_failed': `${actorName} failed to view distributor list`,
        'view_user_data': `${actorName} viewed user data for "${context.userName || 'Unknown User'}"`,
        'view_user_data_failed': `${actorName} failed to view user data`,
        'update_user_profile': `${actorName} updated user profile for "${context.userName || 'Unknown User'}"`,
        'update_user_profile_failed': `${actorName} failed to update user profile`,
        'update_user_password': `${actorName} updated user password for "${context.userName || 'Unknown User'}"`,
        'update_user_password_failed': `${actorName} failed to update user password`,
        'update_user_avatar': `${actorName} updated user avatar for "${context.userName || 'Unknown User'}"`,
        'update_user_avatar_failed': `${actorName} failed to update user avatar`
    };
    
    // Get the base message
    message = actionMessages[action] || `${actorName} performed ${action} on ${resource}`;
    
    // Add additional context if provided
    if (context.additionalInfo) {
        message += ` - ${context.additionalInfo}`;
    }
    
    // Add timestamp context
    if (context.timestamp) {
        message += ` at ${new Date(context.timestamp).toLocaleString()}`;
    }
    
    return message;
};

/**
 * Determine log type based on action
 * @param {String} action - Action performed
 * @returns {String} - Log type (info, success, warning, error)
 */
const getLogType = (action) => {
    const errorActions = ['delete_', 'block_', 'decline_', 'refund_', 'system_'];
    const warningActions = ['impersonate_', 'unblock_', 'reset_', 'maintenance'];
    const successActions = ['create_', 'update_', 'activate_', 'accept_', 'verify_', 'login'];
    
    if (errorActions.some(prefix => action.startsWith(prefix))) {
        return 'warning';
    } else if (warningActions.some(prefix => action.startsWith(prefix))) {
        return 'warning';
    } else if (successActions.some(prefix => action.startsWith(prefix))) {
        return 'success';
    }
    
    return 'info';
};

/**
 * Main logging function for collaborator actions
 * @param {Object} req - Express request object
 * @param {String} action - Action performed
 * @param {String} resource - Resource affected
 * @param {Object} context - Additional context information
 * @returns {Promise<Object>} - Log creation result
 */
const logCollaboratorAction = async (req, action, resource = '', context = {}) => {
    try {
        // Check if logging feature is enabled
        if (!(await isFeatureEnabled('LOGGING'))) {
            console.log('📝 Logging feature is disabled. Log would have been created:', {
                action,
                resource,
                context
            });
            return { success: true, log: { _id: 'disabled' }, message: 'Logging disabled' }; // Return mock success
        }

        // Extract token information
        const tokenInfo = extractTokenInfo(req);
        
        if (!tokenInfo || !tokenInfo.isValid) {
            console.error('Invalid token for logging');
            return { success: false, error: 'Invalid token' };
        }
        
        // Create user-friendly message
        const message = await createLogMessage(action, resource, context, tokenInfo);
        
        // Determine log type
        const logType = getLogType(action);
        
        // Determine user_id (always main account ID)
        const userId = tokenInfo.isImpersonating ? tokenInfo.impersonatedUserId : tokenInfo.userId;
        
        // Create log entry
        const logEntry = new Log({
            message,
            type: logType,
            user_id: userId
        });
        
        const savedLog = await logEntry.save();
        
        console.log(`✅ Log created: ${message}`);
        
        return {
            success: true,
            log: savedLog,
            message,
            actorInfo: {
                isCollaborator: tokenInfo.isCollaborator,
                isImpersonating: tokenInfo.isImpersonating,
                userId: userId,
                collaboratorId: tokenInfo.collaboratorId,
                collaboratorRole: tokenInfo.collaboratorRole
            }
        };
        
    } catch (error) {
        console.error('Error creating collaborator log:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Quick logging function for common actions
 * @param {Object} req - Express request object
 * @param {String} action - Action performed
 * @param {Object} context - Additional context
 */
const quickLog = async (req, action, context = {}) => {
    return await logCollaboratorAction(req, action, '', context);
};

/**
 * Batch logging for multiple actions
 * @param {Object} req - Express request object
 * @param {Array} actions - Array of action objects [{action, resource, context}]
 */
const batchLog = async (req, actions) => {
    const results = [];
    
    for (const actionData of actions) {
        const result = await logCollaboratorAction(
            req, 
            actionData.action, 
            actionData.resource || '', 
            actionData.context || {}
        );
        results.push(result);
    }
    
    return results;
};

module.exports = {
    extractTokenInfo,
    getUserName,
    getCollaboratorName,
    getRoleDisplayName,
    createLogMessage,
    getLogType,
    logCollaboratorAction,
    quickLog,
    batchLog
};
