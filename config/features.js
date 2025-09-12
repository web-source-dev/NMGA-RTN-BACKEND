/**
 * Feature Configuration System
 * Database-based configuration for enabling/disabling various system features
 */

const Feature = require('../models/Feature');

// Default feature definitions
const DEFAULT_FEATURES = {
    // Messaging features
    SMS: {
        enabled: false,
        description: 'SMS Text Message Notifications - Sends text messages to users for important updates including deal expiration alerts, login notifications, password resets, and order confirmations. When enabled, users receive instant text messages on their phones. When disabled, no text messages are sent but all other functionality continues normally.',
        category: 'communication',
        isShowOnPage: true
    },
    
    // Email features
    EMAIL: {
        enabled: false,
        description: 'Email Notifications - Sends email messages to users and administrators for daily commitment summaries, deal expiration notifications, admin reports, and user communications. When enabled, emails are delivered through the email service. When disabled, no emails are sent but all other system functions work normally.',
        category: 'communication',
        isShowOnPage: true
    },
    
    // Notification features
    NOTIFICATIONS: {
        enabled: false,
        description: 'In-App Notification System - Creates notification alerts that appear in user dashboards for deal updates, commitment changes, system announcements, and important events. When enabled, users see notification badges and alerts in their dashboard. When disabled, no notification alerts are created but all other features continue to function.',
        category: 'communication',
        isShowOnPage: true
    },
    
    // Logging features
    LOGGING: {
        enabled: false,
        description: 'Activity Tracking and Audit Trail - Records detailed logs of all user actions, admin activities, deal modifications, user management changes, and system events for security and compliance purposes. When enabled, creates a complete audit trail of all activities. When disabled, no activity logs are recorded but all system functions continue to work.',
        category: 'system',
        isShowOnPage: true
    },
    
    // Deal expiration notifications
    DEAL_EXPIRATION: {
        enabled: false,
        description: 'Automatic Deal Expiration Monitoring - Automatically monitors deals and sends notifications when they are about to expire (5 days, 3 days, 1 day, and 1 hour before expiration). Also automatically changes deal status to inactive when expired. When enabled, users receive timely reminders and deals are automatically managed. When disabled, no expiration notifications are sent and deals remain active even after their expiration date.',
        category: 'automation',
        isShowOnPage: true
    },
    
    // Daily commitment summaries
    DAILY_SUMMARIES: {
        enabled: false,
        description: 'Daily Commitment Summary Reports - Automatically generates and sends daily email reports at 5:00 PM showing commitment statistics, member activity, and distributor performance to administrators and stakeholders. When enabled, daily summary emails are sent automatically. When disabled, no daily summary emails are generated regardless of commitment activity.',
        category: 'automation',
        isShowOnPage: true
    },
    
    // Socket.IO real-time updates
    REALTIME_UPDATES: {
        enabled: false,
        description: 'Real-Time Live Updates - Provides instant live updates to all connected users when deals are created, modified, or deleted. Users see changes immediately without needing to refresh their browser. When enabled, users get live updates as changes happen. When disabled, users must refresh their browser to see the latest changes, but all deal operations still function normally.',
        category: 'system',
        isShowOnPage: true
    },
    
    // Distributor reminders
    DISTRIBUTOR_REMINDERS: {
        enabled: false,
        description: 'Distributor Reminder System - Automatically sends email and SMS reminders to distributors for deal posting deadlines (5, 3, and 1 days before commitment window) and deal approval reminders (5 days after commitment window closes). When enabled, distributors receive timely notifications to post deals and approve commitments. When disabled, no reminder notifications are sent to distributors.',
        category: 'automation',
        isShowOnPage: true
    },
    
    // Member reminders
    MEMBER_REMINDERS: {
        enabled: false,
        description: 'Member Commitment Reminder System - Automatically sends email and SMS reminders to members for commitment window opening (1 day before) and commitment window closing (5, 3, 1 days, and 1 hour before). When enabled, members receive timely notifications about commitment opportunities and deadlines. When disabled, no reminder notifications are sent to members.',
        category: 'automation',
        isShowOnPage: true
    }
};

/**
 * Initialize features in database
 * Creates default features if they don't exist
 */
const initializeFeatures = async () => {
    try {
        console.log('🔧 Initializing features in database...');
        
        for (const [featureName, config] of Object.entries(DEFAULT_FEATURES)) {
            const existingFeature = await Feature.findOne({ name: featureName });
            
            if (!existingFeature) {
                await Feature.create({
                    name: featureName,
                    enabled: config.enabled,
                    description: config.description,
                    category: config.category,
                    isShowOnPage: config.isShowOnPage
                });
                console.log(`✅ Created feature: ${featureName}`);
            }
        }
        
        console.log('✅ Feature initialization completed');
    } catch (error) {
        console.error('❌ Error initializing features:', error);
    }
};

/**
 * Check if a feature is enabled
 * @param {string} featureName - The name of the feature to check
 * @returns {Promise<boolean>} - True if feature is enabled, false otherwise
 */
const isFeatureEnabled = async (featureName) => {
    try {
        const feature = await Feature.findOne({ name: featureName.toUpperCase() });
        if (!feature) {
            console.warn(`Feature '${featureName}' not found in database`);
            return false;
        }
        return feature.enabled;
    } catch (error) {
        console.error(`Error checking feature '${featureName}':`, error);
        return false;
    }
};

/**
 * Get all features and their status
 * @returns {Promise<Object>} - Object containing all features and their status
 */
const getAllFeatures = async () => {
    try {
        const features = await Feature.find({}).sort({ name: 1 });
        const featuresObj = {};
        
        features.forEach(feature => {
            featuresObj[feature.name] = {
                enabled: feature.enabled,
                description: feature.description,
                category: feature.category,
                isShowOnPage: feature.isShowOnPage,
                lastModifiedBy: feature.lastModifiedBy,
                lastModifiedAt: feature.lastModifiedAt
            };
        });
        
        return featuresObj;
    } catch (error) {
        console.error('Error fetching features:', error);
        return {};
    }
};

/**
 * Get features that should be shown on the management page
 * @returns {Promise<Object>} - Object containing only features with isShowOnPage: true
 */
const getVisibleFeatures = async () => {
    try {
        const features = await Feature.find({ isShowOnPage: true }).sort({ name: 1 });
        const featuresObj = {};
        
        features.forEach(feature => {
            featuresObj[feature.name] = {
                enabled: feature.enabled,
                description: feature.description,
                category: feature.category,
                isShowOnPage: feature.isShowOnPage,
                lastModifiedBy: feature.lastModifiedBy,
                lastModifiedAt: feature.lastModifiedAt
            };
        });
        
        return featuresObj;
    } catch (error) {
        console.error('Error fetching visible features:', error);
        return {};
    }
};

/**
 * Enable a specific feature
 * @param {string} featureName - The name of the feature to enable
 * @param {string} userId - The ID of the user making the change
 * @returns {Promise<boolean>} - True if feature was enabled, false if feature not found
 */
const enableFeature = async (featureName, userId = null) => {
    try {
        const feature = await Feature.findOneAndUpdate(
            { name: featureName.toUpperCase() },
            { 
                enabled: true,
                lastModifiedBy: userId,
                lastModifiedAt: new Date()
            },
            { new: true }
        );
        
        if (!feature) {
            console.warn(`Feature '${featureName}' not found in database`);
            return false;
        }
        
        console.log(`✅ Feature '${featureName}' enabled: ${feature.description}`);
        return true;
    } catch (error) {
        console.error(`Error enabling feature '${featureName}':`, error);
        return false;
    }
};

/**
 * Disable a specific feature
 * @param {string} featureName - The name of the feature to disable
 * @param {string} userId - The ID of the user making the change
 * @returns {Promise<boolean>} - True if feature was disabled, false if feature not found
 */
const disableFeature = async (featureName, userId = null) => {
    try {
        const feature = await Feature.findOneAndUpdate(
            { name: featureName.toUpperCase() },
            { 
                enabled: false,
                lastModifiedBy: userId,
                lastModifiedAt: new Date()
            },
            { new: true }
        );
        
        if (!feature) {
            console.warn(`Feature '${featureName}' not found in database`);
            return false;
        }
        
        console.log(`❌ Feature '${featureName}' disabled: ${feature.description}`);
        return true;
    } catch (error) {
        console.error(`Error disabling feature '${featureName}':`, error);
        return false;
    }
};

/**
 * Enable all features
 * @param {string} userId - The ID of the user making the change
 */
const enableAllFeatures = async (userId = null) => {
    try {
        await Feature.updateMany(
            {},
            { 
                enabled: true,
                lastModifiedBy: userId,
                lastModifiedAt: new Date()
            }
        );
        console.log('✅ All features enabled');
    } catch (error) {
        console.error('Error enabling all features:', error);
    }
};

/**
 * Disable all features
 * @param {string} userId - The ID of the user making the change
 */
const disableAllFeatures = async (userId = null) => {
    try {
        await Feature.updateMany(
            {},
            { 
                enabled: false,
                lastModifiedBy: userId,
                lastModifiedAt: new Date()
            }
        );
        console.log('❌ All features disabled');
    } catch (error) {
        console.error('Error disabling all features:', error);
    }
};

/**
 * Log current feature status
 */
const logFeatureStatus = async () => {
    try {
        const features = await getAllFeatures();
        
        console.log('\n📋 Current Feature Status:');
        console.log('========================');
        Object.entries(features).forEach(([name, config]) => {
            const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
            console.log(`${name}: ${status}`);
        });
        console.log('========================\n');
    } catch (error) {
        console.error('Error logging feature status:', error);
    }
};

module.exports = {
    DEFAULT_FEATURES,
    initializeFeatures,
    isFeatureEnabled,
    getAllFeatures,
    getVisibleFeatures,
    enableFeature,
    disableFeature,
    enableAllFeatures,
    disableAllFeatures,
    logFeatureStatus
};
