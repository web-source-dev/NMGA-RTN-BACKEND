const twilio = require('twilio');
const AuthMessages = require('./MessageTemplates/AuthMessages');
const DealMessages = require('./MessageTemplates/DealMessages');

require('dotenv').config();
let twilioClient = null;

// Create a function to initialize Twilio
const initializeTwilio = () => {
    try {
        // Verify environment variables
        const config = {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            phoneNumber: process.env.TWILIO_PHONE_NUMBER
        };

        console.log('Twilio Configuration Check:', {
            accountSid: config.accountSid ? 'Found' : 'Missing',
            authToken: config.authToken ? 'Found' : 'Missing',
            phoneNumber: config.phoneNumber ? 'Found' : 'Missing'
        });

        if (config.accountSid && config.authToken && config.phoneNumber) {
            twilioClient = twilio(config.accountSid, config.authToken);
            console.log('Twilio client initialized successfully');
            return true;
        } else {
            console.warn('Missing required Twilio credentials');
            return false;
        }
    } catch (error) {
        console.error('Error initializing Twilio client:', error);
        return false;
    }
};

// Update sendSMS function with better error handling
const sendSMS = async (to, message) => {
    try {
        if (!twilioClient) {
            throw new Error('Twilio client not initialized. Check credentials.');
        }

        if (!process.env.TWILIO_PHONE_NUMBER) {
            throw new Error('Twilio phone number not configured');
        }

        if (!to || !message) {
            throw new Error('Missing required parameters: ' + (!to ? 'phone number' : 'message'));
        }

        // Validate phone number format
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(to)) {
            throw new Error(`Invalid phone number format: ${to}`);
        }

        const response = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        
        console.log('SMS sent successfully:', {
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to,
            messageId: response.sid,
            status: response.status
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

    login: withErrorHandling(async (phone, userInfo) => {
        const message = AuthMessages.login(userInfo);
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

// Deal-related message functions
const sendDealMessage = {
    newDeal: withErrorHandling(async (phone, dealInfo) => {
        const message = DealMessages.newDeal(dealInfo);
        return await sendSMS(phone, message);
    }),

    dealExpiration: withErrorHandling(async (phone, dealInfo) => {
        const message = DealMessages.dealExpiration(dealInfo);
        return await sendSMS(phone, message);
    }),

    genericMessage: withErrorHandling(async (phone, message) => {
        return await sendSMS(phone, message);
    }),

    commitmentUpdate: withErrorHandling(async (phone, commitmentInfo) => {
        const message = DealMessages.commitmentStatusUpdate(
            commitmentInfo.dealName, 
            commitmentInfo.status, 
            commitmentInfo.modifiedDetails
        );
        return await sendSMS(phone, message);
    }),

    orderConfirmation: withErrorHandling(async (phone, orderInfo) => {
        const message = DealMessages.orderConfirmation(orderInfo);
        return await sendSMS(phone, message);
    }),

    bulkUploadNotification: withErrorHandling(async (phone, count) => {
        const message = DealMessages.bulkUploadSuccess(count);
        return await sendSMS(phone, message);
    })
};

module.exports = {
    sendSMS,
    sendAuthMessage,
    sendDealMessage,
    initializeTwilio
};
