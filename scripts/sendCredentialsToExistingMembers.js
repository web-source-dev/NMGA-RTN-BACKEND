const mongoose = require('mongoose');
const { sendMemberCredentials } = require('./sendMemberCredentials');
require('dotenv').config();

// Simple script to send credentials to existing members
async function main() {
  try {
    console.log('🔐 NMGA Member Credentials Sender');
    console.log('=====================================');
    console.log('This script will send login credentials to members who exist in both:');
    console.log('1. The users.xlsx file (CSV/Excel)');
    console.log('2. The database (already imported members)');
    console.log('');
    
    // Check if Excel file exists
    const fs = require('fs');
    const EXCEL_FILE_PATH = './users.xlsx';
    
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.log('❌ Error: users.xlsx file not found in the current directory.');
      console.log('Please ensure the Excel file is in the same directory as this script.');
      process.exit(1);
    }
    
    console.log('✅ Found users.xlsx file');
    console.log('');
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB connected successfully');
    console.log('');
    
    // Confirm before sending emails
    console.log('⚠️  WARNING: This will send emails to members who exist in BOTH the CSV file and database.');
    console.log('Make sure you want to proceed with this action.');
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');
    console.log('');
    
    // Wait 5 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🚀 Starting credentials sending process...');
    console.log('');
    
    const result = await sendMemberCredentials();
    
    console.log('');
    if (result.success) {
      console.log('✅ Credentials sending process completed successfully!');
      console.log('');
      console.log('📊 Final Statistics:');
      console.log(`   • Emails found in CSV: ${result.stats.csvEmails}`);
      console.log(`   • Members found in database: ${result.stats.dbEmails}`);
      console.log(`   • Members matching both: ${result.stats.matchedEmails}`);
      console.log(`   • Credentials sent successfully: ${result.stats.sent}`);
      console.log(`   • Failed to send: ${result.stats.failed}`);
      console.log(`   • Skipped: ${result.stats.skipped}`);
      
      if (result.stats.errors.length > 0) {
        console.log('');
        console.log('❌ Errors encountered:');
        result.stats.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.member} (${error.email}): ${error.error}`);
        });
      }
    } else {
      console.log('❌ Credentials sending process failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('');
      console.log('Database connection closed');
    }
    process.exit(0);
  }
}

// Run the script
main();
