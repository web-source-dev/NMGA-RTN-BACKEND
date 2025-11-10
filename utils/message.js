const axios = require('axios');
const AuthMessages = require('./MessageTemplates/AuthMessages');
const { isFeatureEnabled } = require('../config/features');

require('dotenv').config();
let smsConfig = {
    apiKey: null,
    sender: null,
    organisationPrefix: null,
    webUrl: null,
    defaultType: 'transactional',
    unicodeEnabled: false
};
let smsClientReady = false;

// Create a function to initialize Brevo SMS
const initializeSmsClient = () => {
    try {
        // Verify environment variables
        const config = {
            apiKey: process.env.BREVO_API_KEY,
            sender: process.env.BREVO_SMS_SENDER,
            organisationPrefix: process.env.BREVO_SMS_ORG_PREFIX || null,
            webUrl: process.env.BREVO_SMS_WEBHOOK || null,
            unicodeEnabled: process.env.BREVO_SMS_UNICODE === 'true'
        };

        console.log('Brevo SMS Configuration Check:', {
            apiKey: config.apiKey ? 'Found' : 'Missing',
            sender: config.sender ? 'Found' : 'Missing',
            organisationPrefix: config.organisationPrefix ? 'Found' : 'Missing (optional)',
            webUrl: config.webUrl ? 'Found' : 'Missing (optional)'
        });

        if (config.apiKey && config.sender) {
            smsConfig = {
                ...smsConfig,
                apiKey: config.apiKey,
                sender: config.sender,
                organisationPrefix: config.organisationPrefix,
                webUrl: config.webUrl,
                unicodeEnabled: config.unicodeEnabled
            };
            smsClientReady = true;
            console.log('Brevo SMS client initialized successfully');
            return true;
        } else {
            console.warn('Missing required Brevo SMS credentials');
            return false;
        }
    } catch (error) {
        console.error('Error initializing Brevo SMS client:', error);
        return false;
    }
};

// Update sendSMS function with better error handling
const sendSMS = async (to, message) => {
    try {
        // Check if SMS feature is enabled
        if (!(await isFeatureEnabled('SMS'))) {
            console.log('📱 SMS feature is disabled. Message would have been sent to:', to);
            console.log('📱 Message content:', message);
            return true; // Return true to indicate "success" but no actual SMS sent
        }

        if (!smsClientReady) {
            throw new Error('Brevo SMS client not initialized. Check credentials.');
        }

        if (!to || !message) {
            throw new Error('Missing required parameters: ' + (!to ? 'phone number' : 'message'));
        }

        // Validate phone number format
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(to)) {
            throw new Error(`Invalid phone number format: ${to}`);
        }

        const payload = {
            sender: smsConfig.sender,
            recipient: to,
            content: message,
            type: smsConfig.defaultType,
            unicodeEnabled: smsConfig.unicodeEnabled
        };

        if (smsConfig.organisationPrefix) {
            payload.organisationPrefix = smsConfig.organisationPrefix;
        }

        if (smsConfig.webUrl) {
            payload.webUrl = smsConfig.webUrl;
        }

        const response = await axios.post(
            'https://api.brevo.com/v3/transactionalSMS/send',
            payload,
            {
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'api-key': smsConfig.apiKey
                }
            }
        );
        
        console.log('SMS sent successfully via Brevo:', {
            from: smsConfig.sender,
            to: to,
            messageId: response?.data?.messageId,
            remainingCredits: response?.data?.remainingCredits
        });
        
        return true;
    } catch (error) {
        console.error('SMS sending failed:', {
            error: error.message,
            code: error.code,
            to: to,
            stack: error.stack
        });
        return false;
    }
};

// Add error handling wrapper for auth messages
const withErrorHandling = (fn) => {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`SMS Error in ${fn.name}:`, error);
            return false;
        }
    };
};

// Auth-related message functions
const sendAuthMessage = {
    registration: withErrorHandling(async (phone, userInfo) => {
        const message = AuthMessages.registration(userInfo.name);
        return await sendSMS(phone, message);
    }),

    passwordReset: withErrorHandling(async (phone, userInfo) => {
        const message = AuthMessages.passwordReset(userInfo.name);
        return await sendSMS(phone, message);
    }),

    accountBlocked: withErrorHandling(async (phone, userInfo) => {
        const message = AuthMessages.accountBlocked(userInfo.name);
        return await sendSMS(phone, message);
    }),

    accountUnblocked: withErrorHandling(async (phone, userInfo) => {
        const message = AuthMessages.accountUnblocked(userInfo.name);
        return await sendSMS(phone, message);
    })
};

module.exports = {
    sendSMS,
    sendAuthMessage,
    initializeSmsClient
};

module.exports.initializeTwilio = initializeSmsClient;
