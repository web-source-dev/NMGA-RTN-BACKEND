require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const checkDealExpiration = require('./utils/dealExpirationCheck');
const { initializeTwilio } = require('./utils/message');
const backupToGoogleSheets = require('./utils/googleSheetsBackup');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
  
})
  .then(() => {
    console.log('MongoDB connected successfully');
    // Start the deal expiration check after DB connection is established
    checkDealExpiration();
    
    // Initial backup with better error handling
   
    
    // Set up the intervals
    setInterval(checkDealExpiration, 24 * 60 * 60 * 1000);
    setInterval(() => {
      backupToGoogleSheets()
        .catch(err => console.error('Scheduled backup failed:', err.message));
    }, 24 * 60 * 60 * 1000); // Daily backup
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.use('/auth', require('./routes/auth/auth'));
app.use('/common', require('./routes/Common/common'));
app.use('/deals', require('./routes/Deals/Deals'));
app.use('/payments', require('./payments/payment'));
app.use('/member', require('./routes/Member/memberRoutes'));
app.use('/chat', require('./routes/Deals/Chat'));
app.use('/api/notifications', require('./routes/Common/Notification').router);
app.use("/api/splash", require("./routes/Common/SplashRoute"))

// Add this near the start of your application
const validateEnvVariables = () => {
    const required = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
        'GOOGLE_SHEET_ID'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        console.warn(`Warning: Missing configuration: ${missing.join(', ')}`);
    }
};

validateEnvVariables();

// Verify environment variables are loaded
console.log('Environment Check:', {
    port: process.env.PORT ? 'Found' : 'Missing',
    twilioSid: process.env.TWILIO_ACCOUNT_SID ? 'Found' : 'Missing',
    twilioToken: process.env.TWILIO_AUTH_TOKEN ? 'Found' : 'Missing',
    twilioPhone: process.env.TWILIO_PHONE_NUMBER ? 'Found' : 'Missing'
});

// Initialize Twilio after environment variables are loaded
initializeTwilio();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
