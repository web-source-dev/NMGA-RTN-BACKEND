const mongoose = require('mongoose');
const User = require('../models/User');
const sendEmail = require('../utils/email');
const memberCredentialsTemplate = require('../utils/EmailTemplates/memberCredentialsTemplate');
const xlsx = require('xlsx');
const fs = require('fs');
require('dotenv').config();

// Counter for statistics
const stats = {
  total: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  csvEmails: 0,
  dbEmails: 0,
  matchedEmails: 0
};

// Function to normalize field names to handle case insensitivity and alternate spellings
function getFieldValue(record, fieldName) {
  // Create variations of field names to check
  const fieldVariations = [
    fieldName,
    fieldName.toUpperCase(),
    fieldName.toLowerCase(),
    fieldName.replace('-', ' '),
    fieldName.replace(' ', '-'),
    fieldName.replace(' ', ''),
    fieldName.replace('-', '')
  ];
  
  // Check all variations
  for (const variant of fieldVariations) {
    if (record[variant] !== undefined) {
      return record[variant];
    }
  }
  
  return undefined;
}

// Check if a value is not empty (handles various empty values)
function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

// Function to read emails from Excel file
function getEmailsFromExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Excel file not found: ${filePath}`);
      return new Set();
    }

    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const allEmails = new Set();

    console.log(`Reading emails from ${sheetNames.length} sheets in Excel file`);

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const results = xlsx.utils.sheet_to_json(worksheet);

      for (const record of results) {
        const emailField = getFieldValue(record, 'EMAIL');
        if (hasValue(emailField)) {
          const normalizedEmail = String(emailField).toLowerCase().trim();
          allEmails.add(normalizedEmail);
        }
      }
    }

    console.log(`Found ${allEmails.size} unique emails in Excel file`);
    return allEmails;
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return new Set();
  }
}

// Function to send credentials to members who exist in both CSV and database
async function sendMemberCredentials() {
  // Reset stats
  stats.total = 0;
  stats.sent = 0;
  stats.failed = 0;
  stats.skipped = 0;
  stats.errors = [];
  stats.csvEmails = 0;
  stats.dbEmails = 0;
  stats.matchedEmails = 0;

  try {
    console.log('Starting to send member credentials...');
    
    // Path to Excel file
    const EXCEL_FILE_PATH = './users.xlsx';
    
    // Get emails from Excel file
    const csvEmails = getEmailsFromExcel(EXCEL_FILE_PATH);
    stats.csvEmails = csvEmails.size;
    
    if (csvEmails.size === 0) {
      console.log('No emails found in Excel file. Please ensure the file exists and contains EMAIL column.');
      return {
        success: false,
        message: 'No emails found in Excel file',
        stats
      };
    }
    
    // Find all members from database
    const dbMembers = await User.find({ 
      role: 'member',
      email: { $exists: true, $ne: '' }
    }).select('name email businessName password');
    
    console.log(`Found ${dbMembers.length} members in database`);
    stats.dbEmails = dbMembers.length;
    
    // Filter members who exist in both CSV and database
    const eligibleMembers = dbMembers.filter(member => {
      const normalizedEmail = member.email.toLowerCase().trim();
      return csvEmails.has(normalizedEmail);
    });
    
    console.log(`Found ${eligibleMembers.length} members who exist in both CSV and database`);
    stats.matchedEmails = eligibleMembers.length;
    stats.total = eligibleMembers.length;
    
    if (eligibleMembers.length === 0) {
      console.log('No members found who exist in both CSV and database.');
      return {
        success: true,
        message: 'No members found who exist in both CSV and database.',
        stats
      };
    }
    
    // Process each eligible member
    for (const member of eligibleMembers) {
      try {
        // Skip if missing required fields
        if (!member.email || !member.name) {
          console.log(`Skipping member ${member._id}: Missing email or name`);
          stats.skipped++;
          continue;
        }
        
        // For security, we'll use a default password since the actual password is hashed
        // The default password used in importUsers.js is 'changeme123'
        const defaultPassword = 'changeme123';
        
        // Create email content
        const emailContent = memberCredentialsTemplate(
          member.name,
          member.email,
          member.businessName || 'Not Provided',
          defaultPassword
        );
        
        // Send email
        await sendEmail(
          member.email,
          'NMGA - Your Account Credentials',
          emailContent
        );
        
        console.log(`✓ Credentials sent to: ${member.name} (${member.email})`);
        stats.sent++;
        
        // Add a small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`✗ Failed to send credentials to ${member.name} (${member.email}):`, error.message);
        stats.failed++;
        stats.errors.push({
          member: member.name,
          email: member.email,
          error: error.message
        });
      }
    }
    
    // Print summary
    console.log('\n======= CREDENTIALS SENDING COMPLETED =======');
    console.log(`Emails found in CSV: ${stats.csvEmails}`);
    console.log(`Members found in database: ${stats.dbEmails}`);
    console.log(`Members matching both CSV and database: ${stats.matchedEmails}`);
    console.log(`Credentials sent successfully: ${stats.sent}`);
    console.log(`Failed to send: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    
    if (stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.member} (${error.email}): ${error.error}`);
      });
    }
    
    return {
      success: true,
      stats: {
        csvEmails: stats.csvEmails,
        dbEmails: stats.dbEmails,
        matchedEmails: stats.matchedEmails,
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        skipped: stats.skipped,
        errors: stats.errors
      }
    };
    
  } catch (error) {
    console.error('Error in sendMemberCredentials:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Export the function for use in routes
module.exports = { sendMemberCredentials };

// If script is run directly, execute the sending process
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(async () => {
    console.log('MongoDB connected successfully');
    
    // Confirm before sending emails
    console.log('\n⚠️  WARNING: This will send emails to members who exist in BOTH the CSV file and database.');
    console.log('Make sure you want to proceed with this action.');
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');
    
    // Wait 5 seconds for user to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const result = await sendMemberCredentials();
    
    if (result.success) {
      console.log('\n✅ Credentials sending process completed successfully!');
    } else {
      console.log('\n❌ Credentials sending process failed:', result.error);
    }
    
    mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
}
