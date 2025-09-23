const mongoose = require('mongoose');
const User = require('../models/User');
const sendEmail = require('../utils/email');
// const memberCredentialsTemplate = require('../utils/EmailTemplates/memberCredentialsTemplate');
const distributorCredentialsTemplate = require('../utils/EmailTemplates/distributorCredentialsTemplate');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const connectToMongoDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('MongoDB connected successfully');
};

const sendCredentials = async () => {
  await connectToMongoDB();
  const users = await User.find({role:"distributor"});
  
  // Initialize tracking object
  const emailReport = {
    timestamp: new Date().toISOString(),
    totalUsers: users.length,
    successful: [],
    failed: [],
    summary: {
      totalSent: 0,
      totalFailed: 0,
      successRate: 0
    }
  };

  console.log(`Starting to send credentials to ${users.length} users...`);

  for (const user of users) {
    try {
      const emailContent = distributorCredentialsTemplate(user.name, user.email, user.businessName, "Password123");
      await sendEmail(user.email, 'NMGA - Access your account', emailContent);
      
      // Track successful email
      emailReport.successful.push({
        email: user.email,
        status: 'success'
      });
      
      emailReport.summary.totalSent++;
      console.log(`✅ Email sent successfully to: ${user.email}`);
      
    } catch (error) {
      // Track failed email
      emailReport.failed.push({
        email: user.email,
        error: error.message,
        status: 'failed'
      });
      
      emailReport.summary.totalFailed++;
      console.error(`❌ Failed to send email to: ${user.email} - Error: ${error.message}`);
    }
  }

  // Calculate success rate
  emailReport.summary.successRate = emailReport.summary.totalSent / users.length * 100;

  // Generate unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                   new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
  const filename = `email-report-${timestamp}.json`;
  const reportPath = path.join(__dirname, '..', 'reports', filename);

  // Create reports directory if it doesn't exist
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Save report to JSON file
  try {
    fs.writeFileSync(reportPath, JSON.stringify(emailReport, null, 2));
    console.log(`\n📊 Email report saved to: ${reportPath}`);
  } catch (error) {
    console.error('❌ Failed to save email report:', error.message);
  }

  // Display summary
  console.log('\n📈 EMAIL SENDING SUMMARY:');
  console.log(`Total Users: ${emailReport.summary.totalSent + emailReport.summary.totalFailed}`);
  console.log(`✅ Successful: ${emailReport.summary.totalSent}`);
  console.log(`❌ Failed: ${emailReport.summary.totalFailed}`);
  console.log(`📊 Success Rate: ${emailReport.summary.successRate.toFixed(2)}%`);

  if (emailReport.failed.length > 0) {
    console.log('\n⚠️  USERS WHO NEED MANUAL EMAIL SENDING:');
    emailReport.failed.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Error: ${user.error}`);
    });
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
};

sendCredentials();