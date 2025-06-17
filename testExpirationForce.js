const mongoose = require('mongoose');
require('./models/Commitments'); // Register Commitment model
const Deal = require('./models/Deals');
const User = require('./models/User');
const sendEmail = require('./utils/email');
const DealsBatchExpirationTemplate = require('./utils/EmailTemplates/DealsBatchExpirationTemplate');
require('dotenv').config();

async function forceTestExpirationEmails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');

    // Get all active deals
    const activeDeals = await Deal.find({ status: 'active' })
      .populate('distributor')
      .populate({
        path: 'commitments',
        model: 'Commitment'
      });

    if (activeDeals.length === 0) {
      console.log('No active deals found');
      return;
    }

    console.log(`Found ${activeDeals.length} active deals`);

    // Get all non-blocked members
    const members = await User.find({ 
      role: 'member',
      isBlocked: false
    });

    if (members.length === 0) {
      console.log('No members found');
      return;
    }

    console.log(`Found ${members.length} active members`);

    // Send test emails to each member
    for (const member of members) {
      try {
        console.log(`Sending test email to ${member.email}...`);
        
        // Send email with all active deals
        await sendEmail(
          member.email,
          `Test: ${activeDeals.length} Active Deals Update`,
          DealsBatchExpirationTemplate(member.name, activeDeals, '3 days')
        );

        console.log(`Successfully sent email to ${member.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${member.email}:`, error);
      }
    }

    console.log('Test completed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test
forceTestExpirationEmails(); 