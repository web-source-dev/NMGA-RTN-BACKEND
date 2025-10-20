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
            parentUserId: decoded.parentUserId || null,
            impersonationType: decoded.impersonationType || null,
            
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
    const { isCollaborator, isImpersonating, userId, collaboratorId, collaboratorRole, adminId, parentUserId } = tokenInfo;
    
    let message = '';
    let actorName = '';
    let actorRole = '';
    
    if (isImpersonating) {
        if (adminId) {
            // Admin impersonating another user
            const adminName = await getUserName(adminId);
            const impersonatedUserName = await getUserName(userId);
            actorName = `${adminName} (impersonating ${impersonatedUserName})`;
            actorRole = 'Administrator';
        } else if (parentUserId) {
            // Parent member impersonating their sub-store
            const parentName = await getUserName(parentUserId);
            const impersonatedUserName = await getUserName(userId);
            actorName = `${parentName} (accessing sub-store ${impersonatedUserName})`;
            actorRole = 'Parent Store';
        } else {
            // Fallback for unknown impersonation type
            const impersonatedUserName = await getUserName(userId);
            actorName = `Unknown User (impersonating ${impersonatedUserName})`;
            actorRole = 'Unknown';
        }
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
        'view_analytics': `${actorName} accessed the comprehensive analytics dashboard to review overall platform performance metrics, key performance indicators, and business insights`,
        'view_weekly_metrics': `${actorName} examined detailed weekly performance metrics including trends, comparisons, and performance indicators across the past seven days`,
        'view_regional_stats': `${actorName} analyzed regional statistics and geographical distribution data to understand location-based performance patterns`,
        'view_business_types': `${actorName} reviewed business type analytics to understand the distribution and performance across different business categories`,
        'view_deal_analytics': `${actorName} accessed comprehensive deal analytics overview including performance metrics, engagement rates, and conversion statistics`,
        'view_deal_categories': `${actorName} examined deal categories statistics to analyze performance distribution across different product and service categories`,
        'view_recent_deals': `${actorName} reviewed recent deals analytics to track latest activity, trends, and performance of newly created or updated deals`,
        
        // Announcement actions
        'create_announcement': `${actorName} successfully created a new platform announcement titled "${context.title || 'Untitled'}" to communicate important updates and information to users`,
        'update_announcement': `${actorName} modified the content and details of announcement "${context.title || 'Untitled'}" to reflect updated information or corrections`,
        'delete_announcement': `${actorName} permanently removed announcement "${context.title || 'Untitled'}" from the system, making it no longer visible to users`,
        'activate_announcement': `${actorName} activated announcement "${context.title || 'Untitled'}", making it visible and active for all targeted users on the platform`,
        'deactivate_announcement': `${actorName} deactivated announcement "${context.title || 'Untitled'}", temporarily hiding it from users while preserving the content for future use`,
        'view_announcements': `${actorName} accessed the announcements management section to review all platform announcements, their status, and engagement metrics`,
        
        // Chat message actions
        'send_message': `${actorName} sent a new message in the chat communication system to facilitate real-time collaboration and discussion with other users`,
        'view_messages': `${actorName} accessed and reviewed chat message history to read conversations, catch up on communications, and stay informed about discussions`,
        'delete_message': `${actorName} removed a chat message from the conversation history, permanently deleting it from the system records`,
        
        // Collaborator actions
        'add_collaborator': `${actorName} successfully added a new team collaborator "${context.collaboratorName || 'Unknown'}" with ${getRoleDisplayName(context.collaboratorRole || 'viewer')} permissions to assist with account management and operations`,
        'update_collaborator': `${actorName} modified the profile information, permissions, or role settings for collaborator "${context.collaboratorName || 'Unknown'}" to reflect updated responsibilities`,
        'delete_collaborator': `${actorName} permanently removed collaborator "${context.collaboratorName || 'Unknown'}" from the team, revoking all access permissions and removing them from the account`,
        'activate_collaborator': `${actorName} reactivated collaborator "${context.collaboratorName || 'Unknown'}", restoring their access permissions and ability to perform assigned tasks`,
        'view_collaborators': `${actorName} accessed the collaborators management page to review the complete list of team members, their roles, permissions, and activity status`,
        'view_collaborator': `${actorName} examined detailed information and activity history for collaborator "${context.collaboratorName || 'Unknown'}", including permissions, recent actions, and profile data`,
        
        // Commitment actions
        'create_commitment': `${actorName} successfully created a new purchase commitment for deal "${context.dealTitle || 'Unknown Deal'}", indicating their intent to participate in this group buying opportunity`,
        'update_commitment': `${actorName} modified their existing commitment details for deal "${context.dealTitle || 'Unknown Deal'}", adjusting quantities, sizes, or other parameters as needed`,
        'delete_commitment': `${actorName} permanently removed their commitment for deal "${context.dealTitle || 'Unknown Deal'}", withdrawing from participation in this group buying opportunity`,
        'view_commitments': `${actorName} accessed their commitments dashboard to review all active, pending, and completed purchase commitments across various deals`,
        'view_commitment': `${actorName} examined detailed information about a specific commitment including quantities, pricing, status, and transaction history`,
        
        // Generic actions
        'login': `${actorName} successfully authenticated and logged into the system, initiating a new secure session to access platform features and functionality`,
        'logout': `${actorName} safely logged out of the system, terminating their current session and securing their account access`,
        'view_dashboard': `${actorName} accessed their personalized dashboard to view key metrics, recent activity, notifications, and quick access to important features`,
        'update_profile': `${actorName} modified their profile information including personal details, contact information, business information, or account preferences`,
        'change_password': `${actorName} successfully changed their account password as part of security maintenance or password policy compliance`,
        'reset_password': `${actorName} initiated a password reset request to regain access to their account through email verification`,
        'verify_email': `${actorName} successfully verified their email address, confirming their identity and activating full account functionality`,
        'block_user': `${actorName} blocked user account "${context.targetUserName || 'Unknown'}", suspending their access and preventing them from using platform features`,
        'unblock_user': `${actorName} unblocked user account "${context.targetUserName || 'Unknown'}", restoring their access and permissions to use the platform`,
        'impersonate_user': `${actorName} initiated administrative impersonation mode to access the account and view the platform as user "${context.targetUserName || 'Unknown'}" for support or troubleshooting purposes`,
        'stop_impersonation': `${actorName} ended the administrative impersonation session and returned to their own account context`,
        'member_login_key_access': `Parent store ${context.parentUserName || 'Unknown'} accessed their sub-store ${context.userName || 'Unknown'}'s account to manage operations and view data`,
        
        // User management actions
        'view_all_users': `${actorName} accessed the comprehensive user management interface to review the complete list of all registered platform users, their roles, and account status`,
        'view_user_data': `${actorName} examined detailed user data and account information for administrative purposes, support, or verification`,
        'view_user_profile': `${actorName} reviewed a specific user's profile information including contact details, business information, activity history, and account settings`,
        'view_member_profile': `${actorName} accessed and reviewed a member's complete profile including their purchase history, commitments, preferences, and business details`,
        'view_distributor_profile': `${actorName} examined a distributor's profile information including their business details, deals catalog, performance metrics, and contact information`,
        'create_user': `${actorName} successfully created a new user account for "${context.targetUserName || 'Unknown'}", setting up their credentials and assigning appropriate permissions and role`,
        'create_user_failed': `${actorName} encountered an error while attempting to create a new user account, which prevented the account creation from completing successfully`,
        'setup_password': `${actorName} configured a secure password for a user account, completing the account setup process and enabling login access`,
        'setup_password_failed': `${actorName} experienced an error while attempting to set up a password for a user account, preventing completion of the account setup`,
        'register': `${actorName} completed the self-registration process, creating a new account with initial profile information and awaiting email verification`,
        
        // File operations
        'upload_file': `${actorName} successfully uploaded file "${context.fileName || 'Unknown File'}" to the system storage for future access and use`,
        'delete_file': `${actorName} permanently removed file "${context.fileName || 'Unknown File'}" from the system storage, deleting it from all records`,
        'download_file': `${actorName} downloaded file "${context.fileName || 'Unknown File'}" from the system storage to their local device`,
        
        // Deal operations
        'create_deal': `${actorName} successfully created a new group buying deal titled "${context.dealTitle || 'Untitled Deal'}", including product details, pricing, quantities, and commitment windows to offer to members`,
        'update_deal': `${actorName} modified the details, pricing, or terms of deal "${context.dealTitle || 'Untitled Deal'}" to reflect updated information or changes in offering`,
        'delete_deal': `${actorName} permanently removed deal "${context.dealTitle || 'Untitled Deal'}" from the platform, canceling all associated activities and removing it from member view`,
        'view_deal': `${actorName} accessed and reviewed comprehensive details for deal "${context.dealTitle || 'Untitled Deal'}", including pricing, specifications, commitment status, and availability`,
        'view_all_deals': `${actorName} browsed the complete catalog of all available deals across all categories, viewing opportunities for group buying and special offers`,
        'view_latest_deals': `${actorName} reviewed the most recently created or updated deals to discover new opportunities and stay informed about the latest offerings`,
        'accept_deal': `${actorName} approved and accepted deal "${context.dealTitle || 'Untitled Deal'}", allowing it to proceed and be visible to potential buyers`,
        'decline_deal': `${actorName} rejected deal "${context.dealTitle || 'Untitled Deal'}", preventing it from proceeding or being offered to members`,
        
        // Payment operations
        'process_payment': `${actorName} successfully processed a payment transaction of $${context.amount || '0.00'} for deal "${context.dealTitle || 'Unknown Deal'}", completing the financial transaction and updating payment records`,
        'view_payments': `${actorName} accessed the payment history dashboard to review all financial transactions, payment statuses, and revenue information`,
        'refund_payment': `${actorName} issued a refund of $${context.amount || '0.00'} for deal "${context.dealTitle || 'Unknown Deal'}", reversing the payment and crediting the customer's account`,
        
        // Notification operations
        'send_notification': `${actorName} created and sent a new notification message to "${context.recipientName || 'Unknown User'}" to communicate important updates, alerts, or information`,
        'view_notifications': `${actorName} accessed their notifications center to review all received alerts, messages, and system updates`,
        'mark_notification_read': `${actorName} marked a notification as read, acknowledging receipt and indicating they have reviewed the information`,
        'delete_notification': `${actorName} permanently removed a notification from their inbox, clearing it from their notification list`,
        
        // System operations
        'system_backup': `${actorName} initiated a comprehensive system backup operation to create a secure copy of all platform data, ensuring data recovery capability`,
        'system_restore': `${actorName} started a system restore operation to recover data from a previous backup and return the system to an earlier state`,
        'system_maintenance': `${actorName} performed critical system maintenance tasks including updates, optimizations, or repairs to ensure platform stability and performance`,
        'system_error': `${actorName} encountered a system error during operation, which may require investigation or technical intervention to resolve`,
        'export_data': `${actorName} initiated a data export operation to extract and download platform data in a structured format for backup, analysis, or reporting purposes`,
        'import_data': `${actorName} imported external data into the system, uploading and processing information to add or update records in the platform database`,
        
        // Log operations
        'view_all_logs': `${actorName} accessed the comprehensive system logs interface to review all platform activities, user actions, errors, and system events for auditing and monitoring purposes`,
        'view_user_logs': `${actorName} examined their personal activity logs to review their own actions, transactions, and interactions within the platform`,
        'view_specific_user_logs': `${actorName} investigated activity logs for a specific user to analyze their behavior, troubleshoot issues, or audit their actions on the platform`,
        
        // Member management operations
        'view_inactive_members': `${actorName} generated and reviewed a detailed report of inactive members who have not engaged with the platform recently, identifying users who may need re-engagement efforts`,
        'view_inactive_members_failed': `${actorName} encountered an error while attempting to generate the inactive members report, preventing the analysis from completing`,
        'view_blocked_members': `${actorName} accessed a comprehensive report of all blocked member accounts to review suspended users and their account status`,
        'view_blocked_members_failed': `${actorName} experienced an error while trying to access the blocked members report, which prevented the report from loading`,
        'block_user_failed': `${actorName} encountered an error while attempting to block a user account, which prevented the account suspension from being completed`,
        'unblock_user_failed': `${actorName} experienced an error while trying to unblock a user account, preventing the restoration of account access`,
        
        // Deal operations
        'view_distributor_deals': `${actorName} accessed their distributor dashboard to view and manage all deals they have created, including active, pending, and completed offerings`,
        'view_admin_all_deals': `${actorName} accessed the administrative dashboard to review the complete catalog of all deals across all distributors for oversight and management`,
        'bulk_approve_commitments': `${actorName} performed a batch approval operation to simultaneously approve multiple member commitments for deal "${context.dealTitle || 'Unknown Deal'}", streamlining the commitment processing workflow`,
        'bulk_approve_commitments_failed': `${actorName} encountered an error during the bulk approval process, which prevented multiple commitments from being approved simultaneously`,
        'bulk_decline_commitments': `${actorName} executed a bulk decline operation to simultaneously reject multiple member commitments for deal "${context.dealTitle || 'Unknown Deal'}", efficiently managing commitment requests`,
        'bulk_decline_commitments_failed': `${actorName} experienced an error while attempting to bulk decline commitments, preventing the batch rejection from completing`,
        'bulk_approve_commitments_admin': `${actorName} used administrative privileges to perform a bulk approval operation for multiple commitments on deal "${context.dealTitle || 'Unknown Deal'}"`,
        'bulk_decline_commitments_admin': `${actorName} utilized administrative authority to execute a bulk decline operation for multiple commitments on deal "${context.dealTitle || 'Unknown Deal'}"`,
        'view_deal_commitments': `${actorName} reviewed all member commitments associated with a specific deal to analyze participation levels, quantities, and commitment status`,
        'update_commitment_status': `${actorName} modified a commitment's status to ${context.status || 'unknown'}, changing its processing state in the workflow`,
        'update_commitment_status_failed': `${actorName} encountered an error while attempting to update a commitment's status, preventing the status change from being saved`,
        'view_deal_analytics': `${actorName} accessed detailed analytics and performance metrics for deal "${context.dealTitle || 'Unknown Deal'}", including engagement rates, conversion data, and revenue information`,
        'view_deal_analytics_failed': `${actorName} experienced an error while loading analytics for the deal, preventing access to performance metrics and statistics`,
        
        // Comparison operations
        'view_comparison_deals': `${actorName} accessed the comparison deals interface to review and analyze pricing, features, and offers across multiple deals for better decision-making`,
        'view_comparison_deals_failed': `${actorName} encountered an error while attempting to access the comparison deals interface, preventing the comparison analysis from loading`,
        'download_comparison_template': `${actorName} downloaded a structured comparison template for deal "${context.dealTitle || 'Unknown Deal'}" to facilitate standardized data entry and price comparison`,
        'download_comparison_template_failed': `${actorName} experienced an error while downloading the comparison template, which prevented the file from being retrieved`,
        'upload_comparison_data': `${actorName} successfully uploaded external comparison data for deal "${context.dealTitle || 'Unknown Deal'}" to enable competitive pricing analysis and market comparison`,
        'upload_comparison_data_failed': `${actorName} encountered an error during the comparison data upload process, preventing the data from being imported into the system`,
        'view_comparison_details': `${actorName} examined detailed comparison information including side-by-side analysis of pricing, specifications, and terms across multiple offerings`,
        'view_comparison_details_failed': `${actorName} experienced an error while loading comparison details, which prevented access to the comparative analysis`,
        'view_comparison_history': `${actorName} reviewed historical comparison data to track pricing trends, market changes, and competitive positioning over time`,
        'view_comparison_history_failed': `${actorName} encountered an error while accessing comparison history, preventing review of past comparison data`,
        
        // Bulk upload operations
        'download_deals_template': `${actorName} downloaded a standardized CSV/Excel template for bulk deal uploads to facilitate efficient creation of multiple deals simultaneously`,
        'bulk_upload_deals': `${actorName} successfully performed a bulk upload operation to create or update multiple deals simultaneously from a structured data file, streamlining deal management`,
        'bulk_upload_deals_failed': `${actorName} encountered an error during the bulk upload process, which prevented the deals from being imported into the system`,
        'bulk_upload_validation_errors': `${actorName} attempted a bulk upload operation that contained data validation errors, preventing the deals from being processed until corrections are made`,
        'bulk_upload_no_deals': `${actorName} completed a bulk upload operation but the file contained no valid deals that could be processed and imported`,
        
        // Chat operations
        'view_chat_messages': `${actorName} accessed the chat interface to view conversation history and read messages exchanged with other platform users`,
        'send_chat_message': `${actorName} composed and sent a new chat message to communicate with another user or team member in real-time`,
        'mark_messages_read': `${actorName} marked multiple chat messages as read, updating their notification status and acknowledging receipt of the communications`,
        
        // Commitment operations
        'create_commitment': `${actorName} successfully submitted a new purchase commitment for deal "${context.dealTitle || 'Unknown Deal'}", expressing their intent to participate in the group buying opportunity`,
        'view_user_commitments': `${actorName} accessed their commitments dashboard to review all their purchase commitments, including pending, approved, and completed transactions`,
        
        // Additional deal operations
        'view_available_deals': `${actorName} browsed the marketplace to view all currently available deals for purchase, exploring group buying opportunities across various categories`,
        'view_available_deals_failed': `${actorName} encountered an error while attempting to view available deals, preventing access to the deals marketplace`,
        'view_deal_categories': `${actorName} explored the deal categories interface to understand the organization and distribution of deals across different product and service types`,
        'view_deal_categories_failed': `${actorName} experienced an error while loading deal categories, which prevented the category listing from displaying`,
        'view_single_deal': `${actorName} accessed comprehensive information for deal "${context.dealName || 'Unknown Deal'}", including detailed specifications, pricing, terms, and participation requirements`,
        'view_single_deal_failed': `${actorName} encountered an error while attempting to view a specific deal's details, preventing access to the deal information`,
        'view_dashboard_stats': `${actorName} accessed their dashboard to review comprehensive statistics including sales, commitments, revenue, and key performance indicators`,
        'view_dashboard_stats_failed': `${actorName} experienced an error while loading dashboard statistics, which prevented the metrics from displaying`,
        'view_admin_all_deals_failed': `${actorName} encountered an error while attempting to view all deals in the administrative interface, preventing access to the complete deals catalog`,
        'view_distributor_deals_failed': `${actorName} experienced an error while loading their distributor deals, which prevented access to their deal management interface`,
        
        // Member commitment operations
        'view_members_with_commitments': `${actorName} accessed a comprehensive report showing all members who have made purchase commitments, including their commitment details, quantities, and transaction values`,
        'view_members_with_commitments_failed': `${actorName} encountered an error while attempting to load the members with commitments report, preventing access to member participation data`,
        'view_member_details': `${actorName} examined detailed profile and activity information for member "${context.memberName || 'Unknown Member'}", including their purchase history, commitments, and engagement patterns`,
        'view_member_details_failed': `${actorName} experienced an error while loading member details, which prevented access to the member's profile and activity information`,
        'view_member_analytics': `${actorName} analyzed detailed analytics and performance metrics for a member, including their spending patterns, commitment history, and engagement statistics`,
        'view_member_analytics_failed': `${actorName} encountered an error while loading member analytics, preventing access to the member's performance data and statistics`,
        
        // Recent activity operations
        'view_recent_activity': `${actorName} accessed the recent activity feed to review the latest deals, commitments, and platform activities for staying up-to-date with current operations`,
        'view_recent_activity_failed': `${actorName} encountered an error while loading the recent activity feed, preventing access to the latest platform updates and activities`,
        
        // Deal commitment operations
        'view_deal_commitments': `${actorName} reviewed all member commitments for a specific deal to analyze participation levels, commitment quantities, and overall deal performance`,
        'view_deal_commitments_failed': `${actorName} experienced an error while attempting to load deal commitments, preventing access to the commitment data`,
        
        // Top performers operations
        'view_all_distributors': `${actorName} accessed the complete directory of all registered distributors on the platform to review their profiles, offerings, and performance metrics`,
        'view_all_distributors_failed': `${actorName} encountered an error while loading the distributors list, preventing access to the distributor directory`,
        'view_top_distributors': `${actorName} reviewed a leaderboard of the highest-performing distributors based on sales volume, deal count, and member engagement metrics`,
        'view_top_distributors_failed': `${actorName} experienced an error while loading the top distributors ranking, preventing access to performance leaderboard data`,
        'view_all_members': `${actorName} accessed the comprehensive members directory to review all registered member accounts, their activity status, and profile information`,
        'view_all_members_failed': `${actorName} encountered an error while loading the members list, preventing access to the member directory`,
        'view_member_details_admin': `${actorName} used administrative privileges to access detailed member information including sensitive data, complete transaction history, and account management options`,
        'view_member_details_admin_failed': `${actorName} experienced an error while attempting to view administrative member details, preventing access to the comprehensive member profile`,
        'view_top_members': `${actorName} reviewed a performance leaderboard of the most active and highest-spending members based on commitment volume, purchase frequency, and total spending`,
        'view_top_members_failed': `${actorName} encountered an error while loading the top members ranking, preventing access to the member performance leaderboard`,
        
        // Deal update operations
        'update_deal': `${actorName} successfully modified the details, pricing, specifications, or terms of deal "${context.dealName || 'Unknown Deal'}" to reflect updated information or market changes`,
        'update_deal_failed': `${actorName} encountered an error while attempting to update a deal, which prevented the modifications from being saved to the system`,
        'update_deal_status': `${actorName} changed the operational status of a deal to ${context.newStatus || 'unknown'}, affecting its visibility and availability to members`,
        'update_deal_status_failed': `${actorName} experienced an error while trying to update a deal's status, preventing the status change from being applied`,
        'update_deal_status_admin': `${actorName} exercised administrative authority to update a deal's status to ${context.newStatus || 'unknown'}, overriding normal permissions for management purposes`,
        'update_deal_status_admin_failed': `${actorName} encountered an error while using administrative privileges to update a deal's status, preventing the change from being completed`,
        
        // Media Manager operations
        'view_media_library': `${actorName} accessed the media library to browse and manage all uploaded images, documents, videos, and other digital assets stored in the platform`,
        'view_media_library_failed': `${actorName} encountered an error while loading the media library, preventing access to the stored digital assets`,
        'view_media_item': `${actorName} opened and previewed media item "${context.mediaName || 'Unknown Media'}" to view its details, properties, and usage information`,
        'view_media_item_failed': `${actorName} experienced an error while attempting to view a media item, preventing access to the file details`,
        'upload_media': `${actorName} successfully uploaded new media file "${context.mediaName || 'Unknown Media'}" to the platform's digital asset library for use in deals and content`,
        'upload_media_failed': `${actorName} encountered an error during the media upload process, which prevented the file from being saved to the library`,
        'upload_media_direct': `${actorName} performed a direct upload of media file "${context.mediaName || 'Unknown Media'}" to cloud storage, bypassing intermediate processing steps`,
        'upload_media_direct_failed': `${actorName} experienced an error during direct media upload, preventing the file from being stored in cloud storage`,
        'update_media': `${actorName} modified the properties, metadata, or content of media file "${context.mediaName || 'Unknown Media'}" to reflect updated information`,
        'update_media_failed': `${actorName} encountered an error while attempting to update media properties, preventing the changes from being saved`,
        'delete_media': `${actorName} permanently removed media file "${context.mediaName || 'Unknown Media'}" from the platform's digital asset library and cloud storage`,
        'delete_media_failed': `${actorName} experienced an error while attempting to delete a media file, preventing the file from being removed`,
        'create_folder': `${actorName} created a new organizational folder "${context.folderName || 'Unknown Folder'}" in the media library to better organize and categorize digital assets`,
        'create_folder_failed': `${actorName} encountered an error while creating a new folder, preventing the folder structure from being updated`,
        'view_folders': `${actorName} browsed the media library folder structure to navigate through organized collections of digital assets`,
        'view_folders_failed': `${actorName} experienced an error while loading the folder structure, preventing navigation of the media library`,
        'update_folder': `${actorName} modified the name, description, or properties of folder "${context.folderName || 'Unknown Folder'}" to reflect organizational changes`,
        'update_folder_failed': `${actorName} encountered an error while updating folder properties, preventing the changes from being saved`,
        'delete_folder': `${actorName} permanently removed folder "${context.folderName || 'Unknown Folder'}" and potentially its contents from the media library organization`,
        'delete_folder_failed': `${actorName} experienced an error while attempting to delete a folder, preventing it from being removed from the library`,
        'view_media_stats': `${actorName} accessed media library statistics to review storage usage, file counts, upload trends, and digital asset management metrics`,
        'view_media_stats_failed': `${actorName} encountered an error while loading media statistics, preventing access to storage and usage metrics`,
        
        // Member operations
        'view_member_stats': `${actorName} accessed their member statistics dashboard to review comprehensive metrics including total commitments, spending history, favorite deals, and activity patterns`,
        'view_member_stats_failed': `${actorName} encountered an error while loading member statistics, preventing access to their performance metrics and activity data`,
        'view_member_commitments': `${actorName} reviewed their complete list of purchase commitments across all deals, including current status, quantities, and payment information`,
        'view_member_commitments_failed': `${actorName} experienced an error while attempting to view their commitments, preventing access to their purchase history`,
        'view_member_favorites': `${actorName} accessed their saved favorites list to review deals they have marked for future consideration or quick access`,
        'view_member_favorites_failed': `${actorName} encountered an error while loading their favorites list, preventing access to their saved deals`,
        'remove_favorite': `${actorName} removed deal "${context.dealName || 'Unknown Deal'}" from their favorites list, unmarking it for future reference`,
        'remove_favorite_failed': `${actorName} experienced an error while attempting to remove a favorite deal, preventing the favorite from being deleted`,
        'cancel_commitment': `${actorName} cancelled their purchase commitment for deal "${context.dealName || 'Unknown Deal'}", withdrawing from the group buying opportunity and voiding the transaction`,
        'cancel_commitment_failed': `${actorName} encountered an error while attempting to cancel their commitment, which prevented the cancellation from being processed`,
        'view_member_analytics': `${actorName} analyzed detailed member performance analytics including purchase patterns, spending trends, engagement metrics, and behavioral insights`,
        'view_member_analytics_failed': `${actorName} experienced an error while loading member analytics, preventing access to detailed performance analysis`,
        'view_user_profile': `${actorName} accessed and reviewed a user's complete profile information including personal details, business information, contact data, and account settings`,
        'view_user_profile_failed': `${actorName} encountered an error while attempting to view a user profile, preventing access to the account information`,
        'update_user_profile': `${actorName} successfully modified their user profile information including personal details, contact information, business data, or account preferences`,
        'update_user_profile_failed': `${actorName} experienced an error while updating their profile, which prevented the changes from being saved to the system`,
        'change_password': `${actorName} successfully updated their account password to enhance security or comply with password policy requirements`,
        'change_password_failed': `${actorName} encountered an error during the password change process, preventing the new password from being set`,
        'update_user_avatar': `${actorName} uploaded and set a new profile avatar image to personalize their account and improve visual identification`,
        'update_user_avatar_failed': `${actorName} experienced an error while uploading or updating their avatar image, preventing the profile picture from being changed`,
        'view_detailed_analytics': `${actorName} accessed comprehensive detailed analytics including advanced metrics, trend analysis, forecasting data, and deep business insights`,
        'view_detailed_analytics_failed': `${actorName} encountered an error while loading detailed analytics, preventing access to advanced metrics and in-depth analysis`,
        'modify_commitment_sizes': `${actorName} adjusted the size quantities in their commitment to reflect changes in their purchase requirements or preferences`,
        'modify_commitment_sizes_failed': `${actorName} experienced an error while modifying commitment sizes, preventing the quantity changes from being saved`,
        'cancel_commitment_via_modification': `${actorName} effectively cancelled their commitment by reducing all size quantities to zero, automatically triggering the commitment cancellation workflow`,
        'access_member_dashboard': `${actorName} logged into and accessed their member dashboard to view their deals, commitments, statistics, and available opportunities`,
        'access_member_dashboard_failed': `${actorName} encountered an error while loading their member dashboard, preventing access to their account overview and features`,
        
        // Add member operations
        'add_new_member': `${actorName} successfully onboarded a new member "${context.memberName || 'Unknown Member'}" to the platform, creating their account and sending welcome credentials`,
        'add_new_member_failed': `${actorName} encountered an error while attempting to add a new member, preventing the account creation and onboarding process from completing`,
        'view_added_members': `${actorName} accessed their list of added members to review all the member accounts they have created and manage their network`,
        'view_added_members_failed': `${actorName} experienced an error while loading the added members list, preventing access to their managed member accounts`,
        'view_member_details': `${actorName} examined comprehensive details for member "${context.memberName || 'Unknown Member'}", including profile information, commitment history, and account activity`,
        'view_member_details_failed': `${actorName} encountered an error while loading member details, which prevented access to the member's profile and activity information`,
        
        // Supplier operations
        'view_suppliers': `${actorName} accessed the suppliers management interface to review all registered suppliers, their assignments, and contact information`,
        'view_suppliers_failed': `${actorName} encountered an error while loading the suppliers list, preventing access to supplier management features`,
        'create_supplier': `${actorName} successfully created a new supplier entry for "${context.supplierName || 'Unknown Supplier'}" in the system to facilitate member-supplier relationships and order fulfillment`,
        'create_supplier_failed': `${actorName} experienced an error while attempting to create a new supplier, preventing the supplier from being added to the system`,
        'assign_supplier': `${actorName} successfully assigned supplier "${context.supplierName || 'Unknown Supplier'}" to member "${context.memberName || 'Unknown Member'}" to establish a business relationship for order fulfillment`,
        'assign_supplier_failed': `${actorName} encountered an error during the supplier assignment process, preventing the supplier-member relationship from being established`,
        'unassign_supplier': `${actorName} removed the assignment of supplier "${context.supplierName || 'Unknown Supplier'}" from member "${context.memberName || 'Unknown Member'}", ending their business relationship`,
        'unassign_supplier_failed': `${actorName} experienced an error while attempting to unassign a supplier from a member, preventing the relationship from being removed`,
        'view_committed_members': `${actorName} accessed a detailed report of all members who have made commitments to their deals, including commitment statistics and purchasing patterns`,
        'view_committed_members_failed': `${actorName} encountered an error while loading the committed members report, preventing access to member participation data`,
        'export_member_data': `${actorName} generated and downloaded a comprehensive export of all data for member "${context.memberName || 'Unknown Member'}", including commitments, transactions, and activity history`,
        'export_member_data_failed': `${actorName} experienced an error during the member data export process, preventing the data from being generated and downloaded`,
        'export_supplier_data': `${actorName} generated and downloaded a complete export of supplier data for "${context.supplierName || 'Unknown Supplier'}", including assigned members, transactions, and fulfillment history`,
        'export_supplier_data_failed': `${actorName} encountered an error during the supplier data export process, which prevented the export file from being created`,
        
        // All Member Distributor operations
        'view_distributor_members': `${actorName} accessed the distributor's member management interface to view all members associated with their business and their commitment activities`,
        'view_distributor_members_failed': `${actorName} encountered an error while loading distributor members, preventing access to the member management interface`,
        'view_distributor_member_details': `${actorName} examined comprehensive details for their distributor member "${context.memberName || 'Unknown Member'}", including commitment history and transaction data`,
        'view_distributor_member_details_failed': `${actorName} experienced an error while loading distributor member details, which prevented access to the member's information`,
        'view_distributor_top_members': `${actorName} reviewed a performance ranking of their top-performing members based on purchase volume, commitment frequency, and total spending`,
        'view_distributor_top_members_failed': `${actorName} encountered an error while loading the distributor's top members ranking, preventing access to performance data`,
        
        // Contact Us operations
        'update_contact_status': `${actorName} changed the processing status of contact form submission to "${context.newStatus || 'unknown'}" for inquiry from "${context.contactName || 'Unknown Contact'}", tracking resolution progress`,
        'update_contact_status_failed': `${actorName} experienced an error while attempting to update contact form status, preventing the status change from being saved`,
        'submit_contact_form': `${actorName} submitted a new contact form inquiry with subject "${context.subject || 'No Subject'}" to reach out to platform administrators for support or information`,
        'submit_contact_form_failed': `${actorName} encountered an error while submitting their contact form, which prevented their inquiry from being sent to administrators`,
        'view_all_contacts': `${actorName} accessed the contact forms management interface to review all submitted inquiries, questions, and support requests from platform users`,
        'view_all_contacts_failed': `${actorName} experienced an error while loading all contact form submissions, preventing access to user inquiries and support requests`,
        
        // User operations
        'view_distributor_list': `${actorName} accessed the complete directory of all registered distributors to review their business profiles and contact information`,
        'view_distributor_list_failed': `${actorName} encountered an error while loading the distributor directory, preventing access to the distributor listings`,
        'view_user_data': `${actorName} examined detailed account data and profile information for user "${context.userName || 'Unknown User'}" for administrative or support purposes`,
        'view_user_data_failed': `${actorName} experienced an error while attempting to view user data, which prevented access to the account information`,
        'update_user_profile': `${actorName} successfully modified profile information for user "${context.userName || 'Unknown User'}", updating their personal details, business information, or contact data`,
        'update_user_profile_failed': `${actorName} encountered an error while updating user profile information, preventing the changes from being saved to the account`,
        'update_user_password': `${actorName} changed the account password for user "${context.userName || 'Unknown User'}" to enhance security or reset access credentials`,
        'update_user_password_failed': `${actorName} experienced an error during the password update process, which prevented the new password from being set`,
        'update_user_avatar': `${actorName} uploaded and updated the profile avatar image for user "${context.userName || 'Unknown User'}" to personalize their account appearance`,
        'update_user_avatar_failed': `${actorName} encountered an error while updating the user avatar, preventing the profile picture from being changed`,
        
        // Payment operations
        'view_recent_payments': `${actorName} accessed the recent payments dashboard to review the latest financial transactions, payment statuses, and revenue information`,
        'view_payment_analytics': `${actorName} analyzed comprehensive payment analytics including transaction trends, revenue patterns, payment methods distribution, and financial performance metrics`,
        'view_payment_details': `${actorName} examined detailed information for a specific payment transaction including amount, method, status, timestamp, and associated deal information`,
        'create_payment': `${actorName} successfully created and recorded a new payment transaction in the system, documenting the financial exchange and updating account balances`,
        'update_payment_status': `${actorName} modified the payment processing status to "${context.status || 'unknown'}", updating the transaction state and triggering appropriate workflows`,
        
        // Notification operations
        'view_recent_notifications': `${actorName} accessed their recent notifications to review the latest alerts, updates, and important messages from the platform`,
        'mark_notification_read': `${actorName} marked a notification as read, acknowledging they have reviewed the information and updating their notification status`,
        'create_notification': `${actorName} generated a new notification message to communicate important updates, alerts, or information to targeted users`,
        'view_unread_count': `${actorName} checked their unread notifications count to see how many new alerts and messages are awaiting their attention`,
        'delete_notification': `${actorName} permanently removed a notification from their inbox, clearing it from their notification history`,
        
        // Splash page operations
        'create_splash_page': `${actorName} designed and created a new splash page titled "${context.title || 'Untitled'}" for displaying important announcements, promotions, or onboarding content to users`,
        'view_splash_pages': `${actorName} accessed the splash page management interface to review all created splash pages, their status, and engagement metrics`,
        'view_splash_page': `${actorName} previewed a specific splash page to review its content, design, targeting settings, and display configuration`,
        'update_splash_page': `${actorName} modified the content, design, or settings of a splash page to reflect updated information or improve user engagement`,
        'delete_splash_page': `${actorName} permanently removed a splash page from the system, preventing it from being displayed to users`,
        'track_splash_view': `${actorName} viewed a splash page as an end user, with the interaction being tracked for analytics and engagement measurement`,
        'track_splash_close': `${actorName} dismissed and closed a splash page, with this interaction being recorded for user experience analysis`,
        'track_splash_cta': `${actorName} clicked the call-to-action button on a splash page, indicating engagement with the promotional or informational content`,
        
        // User statistics
        'view_user_stats': `${actorName} accessed the comprehensive user statistics overview to review platform-wide user metrics, growth trends, and engagement patterns`,
        'view_recent_users': `${actorName} reviewed a list of recently registered or active users to track new sign-ups and monitor platform growth`,
        
        // Feature management
        'check_feature_status': `${actorName} queried the system to check whether feature "${context.featureName || 'Unknown'}" is currently enabled or disabled for operational control`,
        'enable_feature': `${actorName} activated platform feature "${context.featureName || 'Unknown'}", making it available for use by authorized users and enabling its functionality`,
        'disable_feature': `${actorName} deactivated platform feature "${context.featureName || 'Unknown'}", temporarily removing its availability while preserving configuration settings`,
        'enable_all_features': `${actorName} performed a bulk activation operation to enable all platform features simultaneously, restoring full system functionality`,
        'disable_all_features': `${actorName} executed a bulk deactivation operation to disable all platform features, likely for maintenance or emergency purposes`,
        'view_feature_management': `${actorName} accessed the feature management control panel to review and configure all platform feature toggles and their current status`,
        'view_all_features': `${actorName} reviewed the complete list of all platform features including hidden experimental or administrative features for comprehensive system oversight`,
        
        // Commitment details
        'view_commitment_details': `${actorName} examined comprehensive details for a specific commitment including size quantities, pricing breakdown, status history, and transaction information`,
        'view_all_commitments': `${actorName} accessed the complete commitments database to review all purchase commitments across all deals, users, and time periods for analysis and management`,
        'view_commitment_statistics': `${actorName} analyzed aggregated commitment statistics including total counts, value totals, status distributions, and trend analysis across the platform`,
        'view_distributor_commitments': `${actorName} reviewed all commitments specifically related to their distributor account to monitor sales performance and member engagement`,
        
        // Favorite operations
        'view_favorites': `${actorName} browsed their curated list of favorite deals that they have bookmarked for quick access and future reference`,
        'add_favorite': `${actorName} bookmarked deal "${context.dealTitle || 'Unknown Deal'}" to their favorites list for easy access and to track deals of interest`,
        'toggle_favorite': `${actorName} toggled the favorite status for a deal, either adding it to or removing it from their bookmarked deals list`,
        
        // Order operations
        'view_distributor_orders': `${actorName} accessed their comprehensive orders management dashboard to review all purchase orders, commitments, and transactions from their member base`,
        'view_order_details': `${actorName} examined detailed information for a specific order including customer details, product information, quantities, pricing, delivery status, and payment information`,
        'update_delivery_status': `${actorName} modified the delivery tracking status to "${context.deliveryStatus || 'unknown'}" to reflect the current shipment state and keep customers informed`,
        'update_order_status': `${actorName} changed the order processing status to "${context.status || 'unknown'}", advancing the order through the fulfillment workflow`,
        'update_payment_status': `${actorName} updated the payment processing status to "${context.paymentStatus || 'unknown'}", reflecting the current financial transaction state`,
        'generate_invoice': `${actorName} created and generated a formal invoice document for an order, producing a professional billing statement for record-keeping and customer delivery`,
        'view_filtered_orders': `${actorName} applied ${context.filters || 0} custom filters to view a refined subset of orders matching specific criteria such as date range, status, or customer`,
        'download_orders': `${actorName} exported and downloaded ${context.totalOrders || 0} orders in ${context.format || 'unknown'} format for offline analysis, record-keeping, or reporting purposes`,
        
        // Daily commitment summary operations
        'daily_commitment_summaries_disabled': `System: Daily commitment summaries feature is currently disabled in the platform configuration`,
        'daily_commitment_summaries_completed': `System successfully sent ${context.summariesSent || 0} daily commitment summary emails to users and distributors, providing comprehensive updates on daily commitment activities and transactions`,
        'daily_commitment_summaries_failed': `System encountered a critical error while attempting to send daily commitment summaries, preventing automated reporting from completing successfully`,
        
        // Member commitment window reminder operations
        'member_commitment_window_opening_reminder_sent': `System sent commitment window opening reminder to ${context.userName || 'member'} for ${context.commitmentMonth || 'upcoming month'}, notifying them that the commitment period will begin tomorrow and they can start making purchase commitments`,
        'member_commitment_window_opening_reminder_failed': `System failed to send commitment window opening reminder to ${context.userName || 'member'}, preventing them from being notified about the upcoming commitment period`,
        'member_commitment_window_opening_reminders_summary': `System completed commitment window opening reminder batch for ${context.commitmentMonth || 'current month'}. Total Members: ${context.totalMembers || 0}, Successfully Sent: ${context.emailsSent || 0}, Failed: ${context.emailsFailed || 0}, Skipped (Already Notified): ${context.emailsSkipped || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients, Skipped: ${(context.skippedEmails || []).length} recipients`,
        'member_commitment_window_closing_reminder_sent': `System sent ${context.timeRemaining || 'closing'} reminder to ${context.userName || 'member'} for ${context.commitmentMonth || 'current month'}, alerting them that the commitment window will close soon - this member has not yet made any commitments and should act now`,
        'member_commitment_window_closing_reminder_failed': `System failed to send ${context.timeRemaining || 'closing'} reminder to ${context.userName || 'member'}, preventing them from being notified about the approaching commitment deadline`,
        'member_commitment_window_closing_reminders_summary': `System completed commitment window ${context.timeRemaining || 'closing'} reminder batch for ${context.commitmentMonth || 'current month'}. Total Members: ${context.totalMembers || 0}, Successfully Sent: ${context.emailsSent || 0} (to members without commitments), Failed: ${context.emailsFailed || 0}, Skipped (Already Notified): ${context.emailsSkippedDuplicate || 0}, Skipped (Has Commitments): ${context.emailsSkippedHasCommitments || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients, Skipped (Duplicate): ${(context.skippedDuplicateEmails || []).length} recipients, Skipped (Has Commitments): ${(context.skippedHasCommitmentsEmails || []).length} recipients`,
        'commitment_window_opening_reminder_check_failed': `System encountered a critical error during the commitment window opening reminder check process, preventing opening reminders from being sent to members`,
        'commitment_window_closing_reminder_check_failed': `System encountered a critical error during the commitment window closing reminder check process, preventing closing reminders from being sent to members`,
        
        // Distributor reminder operations  
        'distributor_posting_reminder_sent': `System sent ${context.daysUntilDeadline || 'N'}-day posting deadline reminder to distributor ${context.userName || 'unknown'} for ${context.deliveryMonth || 'upcoming month'}, notifying them to post their deals before the monthly deadline to participate in the group buying program`,
        'distributor_posting_reminder_failed': `System failed to send ${context.daysUntilDeadline || 'N'}-day posting reminder to distributor ${context.userName || 'unknown'}, preventing them from being notified about the approaching posting deadline`,
        'distributor_posting_reminders_summary': `System completed posting deadline ${context.daysUntilDeadline || 'N'}-day reminder batch for ${context.deliveryMonth || 'upcoming month'}. Total Distributors: ${context.totalDistributors || 0}, Successfully Sent: ${context.emailsSent || 0}, Failed: ${context.emailsFailed || 0}, Skipped (Already Notified): ${context.emailsSkipped || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients, Skipped: ${(context.skippedEmails || []).length} recipients`,
        'distributor_approval_reminder_sent': `System sent deal approval reminder to distributor ${context.userName || 'unknown'} for ${context.dealsCount || 0} deal(s) with ${context.totalCommitments || 0} commitments awaiting review and approval, prompting them to process pending member commitments`,
        'distributor_approval_reminder_failed': `System failed to send approval reminder to distributor ${context.userName || 'unknown'}, preventing them from being notified about deals requiring commitment approval`,
        'distributor_approval_reminders_summary': `System completed distributor approval reminder batch. Total Distributors: ${context.totalDistributors || 0}, Total Deals: ${context.totalDeals || 0}, Successfully Sent: ${context.emailsSent || 0}, Failed: ${context.emailsFailed || 0}, Skipped (Already Notified): ${context.emailsSkipped || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients, Skipped: ${(context.skippedEmails || []).length} recipients`,
        'posting_deadline_reminder_check_failed': `System encountered a critical error during the posting deadline reminder check process, preventing posting reminders from being sent to distributors`,
        'approval_reminder_check_failed': `System encountered a critical error during the approval reminder check process, preventing approval reminders from being sent to distributors`,
        
        // Deal expiration notification operations
        'deal_expiration_notification_sent': `System sent ${context.timeRemaining || 'expiration'} notification to ${context.userName || 'member'} for ${context.dealsCount || 0} expiring deal(s), alerting them about deals that are about to close so they can make last-minute commitments`,
        'batch_expiration_notification_failed': `System failed to send ${context.timeRemaining || 'expiration'} notification to ${context.userName || 'member'}, preventing them from being alerted about expiring deals`,
        'deal_expiration_notifications_summary': `System completed deal expiration ${context.timeRemaining || 'N'} notifications batch. Total Users: ${context.totalUsers || 0}, Total Deals: ${context.totalDeals || 0}, Successfully Sent: ${context.emailsSent || 0}, Failed: ${context.emailsFailed || 0}, Skipped (Already Notified): ${context.emailsSkipped || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients, Skipped: ${(context.skippedEmails || []).length} recipients`,
        'sms_expiration_notification_failed': `System failed to send SMS expiration notification to ${context.userName || 'member'} for deal "${context.dealName || 'unknown'}" with ${context.timeRemaining || 'unknown time'} remaining`,
        'deal_auto_deactivated': `System automatically deactivated deal "${context.dealName || 'Unknown Deal'}" due to expiration, changing its status from active to inactive as the deal timeframe has ended`,
        'deal_expiration_check_failed': `System encountered a critical error during the deal expiration check process, preventing expiration notifications and automatic deal deactivation from completing`,
        
        // Daily commitment status summary operations
        'send_daily_commitment_status_summary_failed': `System failed to send daily commitment status summary to ${context.userName || 'member'}, preventing them from receiving their daily update about approved and declined commitments`,
        'send_daily_commitment_status_summaries_completed': `System successfully completed daily commitment status summary batch for today. Total Users: ${context.totalUsers || 0}, Status Changes: ${context.totalStatusChanges || 0}, Successfully Sent: ${context.emailsSent || 0}, Failed: ${context.emailsFailed || 0}. Sent to: ${(context.sentToEmails || []).length} recipients, Failed: ${(context.failedEmails || []).length} recipients`
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
    if (action.includes('_failed') || action.includes('error')) {
        return 'error';
    }
    
    const errorActions = ['delete_', 'block_', 'decline_', 'refund_', 'cancel_'];
    const warningActions = ['impersonate_', 'unblock_', 'reset_', 'maintenance', 'modify_'];
    const successActions = ['create_', 'update_', 'activate_', 'accept_', 'verify_', 'login', 'add_', 'approve_'];
    
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
 * Determine log severity based on action and context
 * @param {String} action - Action performed
 * @param {Object} context - Additional context
 * @returns {String} - Severity level (low, medium, high, critical)
 */
const getLogSeverity = (action, context = {}) => {
    // Critical actions
    const criticalActions = ['delete_user', 'delete_deal', 'system_error', 'security_breach', 
                            'unauthorized_access', 'bulk_delete', 'data_corruption'];
    if (criticalActions.some(prefix => action.includes(prefix))) {
        return 'critical';
    }
    
    // High severity actions
    const highActions = ['block_user', 'bulk_decline', 'refund_payment', 'impersonate_user',
                         'reset_password', 'delete_', 'cancel_'];
    if (highActions.some(prefix => action.includes(prefix))) {
        return 'high';
    }
    
    // Medium severity actions
    const mediumActions = ['create_', 'update_', 'modify_', 'approve_', 'decline_', 'activate_', 'deactivate_'];
    if (mediumActions.some(prefix => action.includes(prefix))) {
        return 'medium';
    }
    
    // Low severity (default)
    return 'low';
};

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {String} - IP address
 */
const getIpAddress = (req) => {
    return req.ip || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           'Unknown';
};

/**
 * Extract user agent from request
 * @param {Object} req - Express request object
 * @returns {String} - User agent
 */
const getUserAgent = (req) => {
    return req.headers['user-agent'] || 'Unknown';
};

/**
 * Generate tags based on action and context
 * @param {String} action - Action performed
 * @param {String} resource - Resource affected
 * @param {Object} context - Additional context
 * @param {Object} tokenInfo - Token information
 * @returns {Array<String>} - Array of tags
 */
const generateTags = (action, resource, context, tokenInfo) => {
    const tags = [];
    
    // Add action category tags
    if (action.includes('create')) tags.push('creation');
    if (action.includes('update') || action.includes('modify')) tags.push('modification');
    if (action.includes('delete')) tags.push('deletion');
    if (action.includes('view')) tags.push('read-only');
    if (action.includes('bulk')) tags.push('bulk-operation');
    if (action.includes('upload')) tags.push('file-operation');
    if (action.includes('download')) tags.push('file-operation');
    
    // Add resource tags
    if (resource) tags.push(resource);
    
    // Add user role tags
    if (tokenInfo.isImpersonating) {
        tags.push('impersonation');
        if (tokenInfo.adminId) tags.push('admin-impersonation');
        if (tokenInfo.parentUserId) tags.push('parent-impersonation');
    }
    if (tokenInfo.isCollaborator) tags.push('collaborator');
    if (tokenInfo.userRole === 'admin') tags.push('admin-action');
    
    // Add context-based tags
    if (context.category) tags.push(context.category);
    if (context.status) tags.push(`status-${context.status}`);
    if (action.includes('failed')) tags.push('failed-action');
    
    return tags;
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
    const startTime = Date.now();
    
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
        
        // Determine log type and severity
        const logType = context.logType || getLogType(action);
        const severity = context.severity || getLogSeverity(action, context);
        
        // Determine user_id (always main account ID)
        const userId = tokenInfo.isImpersonating ? tokenInfo.impersonatedUserId : tokenInfo.userId;
        
        // Get user information
        const user = await User.findById(userId).select('name email role');
        
        // Build collaborator information if applicable
        let collaboratorInfo = null;
        if (tokenInfo.isCollaborator && tokenInfo.collaboratorId) {
            const collaboratorName = await getCollaboratorName(tokenInfo.userId, tokenInfo.collaboratorId);
            collaboratorInfo = {
                id: tokenInfo.collaboratorId,
                name: collaboratorName,
                email: tokenInfo.collaboratorEmail,
                role: tokenInfo.collaboratorRole
            };
        }
        
        // Build impersonation information if applicable
        let impersonationInfo = null;
        if (tokenInfo.isImpersonating) {
            const impersonatedUser = await User.findById(tokenInfo.impersonatedUserId).select('name email');
            
            if (tokenInfo.adminId) {
                // Admin impersonation
                const adminUser = await User.findById(tokenInfo.adminId).select('name email');
                impersonationInfo = {
                    type: 'admin',
                    adminId: tokenInfo.adminId,
                    adminName: adminUser ? adminUser.name : 'Unknown Admin',
                    adminEmail: adminUser ? adminUser.email : 'Unknown Email',
                    impersonatedUserId: tokenInfo.impersonatedUserId,
                    impersonatedUserName: impersonatedUser ? impersonatedUser.name : 'Unknown User',
                    impersonatedUserEmail: impersonatedUser ? impersonatedUser.email : 'Unknown Email'
                };
            } else if (tokenInfo.parentUserId) {
                // Parent member impersonation
                const parentUser = await User.findById(tokenInfo.parentUserId).select('name email businessName');
                impersonationInfo = {
                    type: 'member',
                    parentUserId: tokenInfo.parentUserId,
                    parentName: parentUser ? parentUser.name : 'Unknown Parent',
                    parentEmail: parentUser ? parentUser.email : 'Unknown Email',
                    parentBusinessName: parentUser ? parentUser.businessName : 'Unknown Business',
                    impersonatedUserId: tokenInfo.impersonatedUserId,
                    impersonatedUserName: impersonatedUser ? impersonatedUser.name : 'Unknown User',
                    impersonatedUserEmail: impersonatedUser ? impersonatedUser.email : 'Unknown Email'
                };
            } else {
                // Unknown impersonation type
                impersonationInfo = {
                    type: 'unknown',
                    impersonatedUserId: tokenInfo.impersonatedUserId,
                    impersonatedUserName: impersonatedUser ? impersonatedUser.name : 'Unknown User'
                };
            }
        }
        
        // Build request information
        const requestInfo = {
            ipAddress: getIpAddress(req),
            userAgent: getUserAgent(req),
            method: req.method,
            endpoint: req.originalUrl || req.url,
            statusCode: context.statusCode || 200
        };
        
        // Generate tags
        const tags = generateTags(action, resource, context, tokenInfo);
        
        // Extract metadata from context
        const metadata = {
            ...context,
            // Remove fields that have dedicated schema fields
            additionalInfo: undefined,
            logType: undefined,
            severity: undefined,
            statusCode: undefined,
            dealId: context.dealId || undefined,
            dealTitle: context.dealTitle || undefined,
            commitmentId: context.commitmentId || undefined,
            userId: context.userId || undefined,
            userName: context.userName || undefined,
            memberName: context.memberName || undefined,
            memberEmail: context.memberEmail || undefined,
            totalCommitments: context.totalCommitments || undefined,
            totalAmount: context.totalAmount || undefined,
            totalRevenue: context.totalRevenue || undefined
        };
        
        // Remove undefined values from metadata
        Object.keys(metadata).forEach(key => 
            metadata[key] === undefined && delete metadata[key]
        );
        
        // Create comprehensive log entry
        const logEntry = new Log({
            // Legacy fields
            message,
            type: logType,
            user_id: userId,
            
            // New structured fields
            action,
            resource,
            resourceId: context.dealId || context.commitmentId || context.resourceId || null,
            resourceName: context.dealTitle || context.dealName || context.resourceName || null,
            
            // User information
            userName: user ? user.name : 'Unknown User',
            userEmail: user ? user.email : 'Unknown Email',
            userRole: user ? user.role : tokenInfo.userRole,
            
            // Collaborator information
            isCollaborator: tokenInfo.isCollaborator,
            collaborator: collaboratorInfo,
            
            // Impersonation information
            isImpersonating: tokenInfo.isImpersonating,
            impersonation: impersonationInfo,
            
            // Request metadata
            requestInfo,
            
            // Additional data
            metadata,
            tags,
            severity,
            
            // Status
            status: action.includes('failed') ? 'failure' : 'success',
            
            // Error details if applicable
            errorDetails: context.error ? {
                errorMessage: context.error.message || context.error,
                errorStack: context.error.stack,
                errorCode: context.error.code
            } : undefined,
            
            // Changes tracking
            changes: context.changes || undefined,
            
            // Session tracking
            sessionId: req.sessionID || req.headers['x-session-id'] || null,
            
            // Performance
            duration: null // Will be updated below
        });
        
        // Calculate duration
        const endTime = Date.now();
        logEntry.duration = endTime - startTime;
        
        const savedLog = await logEntry.save();
        
        console.log(`✅ Log created [${severity.toUpperCase()}]: ${message}`);
        
        return {
            success: true,
            log: savedLog,
            message,
            actorInfo: {
                isCollaborator: tokenInfo.isCollaborator,
                isImpersonating: tokenInfo.isImpersonating,
                userId: userId,
                collaboratorId: tokenInfo.collaboratorId,
                collaboratorRole: tokenInfo.collaboratorRole,
                adminId: tokenInfo.adminId,
                parentUserId: tokenInfo.parentUserId,
                impersonationType: tokenInfo.impersonationType
            }
        };
        
    } catch (error) {
        console.error('Error creating collaborator log:', error);
        
        // Try to create a minimal error log
        try {
            const errorLog = new Log({
                message: `Failed to create log for action: ${action} - Error: ${error.message}`,
                type: 'error',
                action: 'logging_error',
                resource: 'system',
                severity: 'high',
                status: 'failure',
                errorDetails: {
                    errorMessage: error.message,
                    errorStack: error.stack
                },
                requestInfo: {
                    ipAddress: getIpAddress(req),
                    method: req.method,
                    endpoint: req.originalUrl || req.url
                },
                duration: Date.now() - startTime
            });
            
            await errorLog.save();
        } catch (fallbackError) {
            console.error('Failed to create fallback error log:', fallbackError);
        }
        
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

/**
 * Log with before/after state for tracking changes
 * @param {Object} req - Express request object
 * @param {String} action - Action performed
 * @param {String} resource - Resource affected
 * @param {Object} before - State before change
 * @param {Object} after - State after change
 * @param {Object} context - Additional context
 */
const logWithChanges = async (req, action, resource, before, after, context = {}) => {
    return await logCollaboratorAction(req, action, resource, {
        ...context,
        changes: { before, after }
    });
};

/**
 * Log an error with full details
 * @param {Object} req - Express request object
 * @param {String} action - Action that failed
 * @param {String} resource - Resource affected
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
const logError = async (req, action, resource, error, context = {}) => {
    return await logCollaboratorAction(req, `${action}_failed`, resource, {
        ...context,
        error: {
            message: error.message,
            stack: error.stack,
            code: error.code || error.statusCode
        },
        logType: 'error',
        severity: 'high',
        statusCode: error.statusCode || 500
    });
};

/**
 * Log a security event
 * @param {Object} req - Express request object
 * @param {String} event - Security event
 * @param {Object} context - Additional context
 */
const logSecurityEvent = async (req, event, context = {}) => {
    return await logCollaboratorAction(req, event, 'security', {
        ...context,
        severity: 'critical',
        tags: ['security', 'audit']
    });
};

/**
 * Create a system log (without user context)
 * @param {String} action - Action performed
 * @param {String} resource - Resource affected
 * @param {Object} context - Additional context
 */
const logSystemAction = async (action, resource = '', context = {}) => {
    try {
        if (!(await isFeatureEnabled('LOGGING'))) {
            return { success: true, log: { _id: 'disabled' }, message: 'Logging disabled' };
        }

        const logEntry = new Log({
            message: context.message || `System: ${action} on ${resource}`,
            type: getLogType(action),
            action,
            resource,
            resourceId: context.resourceId || null,
            resourceName: context.resourceName || null,
            severity: context.severity || getLogSeverity(action, context),
            status: action.includes('failed') ? 'failure' : 'success',
            metadata: context,
            tags: ['system', ...(context.tags || [])],
            requestInfo: {
                method: 'SYSTEM',
                endpoint: 'internal'
            }
        });
        
        const savedLog = await logEntry.save();
        console.log(`✅ System log created: ${logEntry.message}`);
        
        return { success: true, log: savedLog };
    } catch (error) {
        console.error('Error creating system log:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get analytics from logs
 * @param {Object} filter - Filter criteria
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} - Analytics data
 */
const getLogAnalytics = async (filter = {}, startDate = null, endDate = null) => {
    try {
        const query = { ...filter };
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = startDate;
            if (endDate) query.createdAt.$lte = endDate;
        }
        
        const logs = await Log.find(query);
        
        return {
            total: logs.length,
            byType: logs.reduce((acc, log) => {
                acc[log.type] = (acc[log.type] || 0) + 1;
                return acc;
            }, {}),
            bySeverity: logs.reduce((acc, log) => {
                acc[log.severity] = (acc[log.severity] || 0) + 1;
                return acc;
            }, {}),
            byAction: logs.reduce((acc, log) => {
                acc[log.action] = (acc[log.action] || 0) + 1;
                return acc;
            }, {}),
            byResource: logs.reduce((acc, log) => {
                if (log.resource) acc[log.resource] = (acc[log.resource] || 0) + 1;
                return acc;
            }, {}),
            byUser: logs.reduce((acc, log) => {
                if (log.userName) acc[log.userName] = (acc[log.userName] || 0) + 1;
                return acc;
            }, {}),
            errors: logs.filter(log => log.type === 'error' || log.status === 'failure').length,
            averageDuration: logs.filter(log => log.duration).reduce((sum, log) => sum + log.duration, 0) / 
                            logs.filter(log => log.duration).length || 0,
            collaboratorActions: logs.filter(log => log.isCollaborator).length,
            impersonationActions: logs.filter(log => log.isImpersonating).length
        };
    } catch (error) {
        console.error('Error generating log analytics:', error);
        return null;
    }
};

module.exports = {
    // Core functions
    extractTokenInfo,
    getUserName,
    getCollaboratorName,
    getRoleDisplayName,
    createLogMessage,
    getLogType,
    getLogSeverity,
    
    // Logging functions
    logCollaboratorAction,
    quickLog,
    batchLog,
    logWithChanges,
    logError,
    logSecurityEvent,
    logSystemAction,
    
    // Utility functions
    getIpAddress,
    getUserAgent,
    generateTags,
    
    // Analytics
    getLogAnalytics
};
