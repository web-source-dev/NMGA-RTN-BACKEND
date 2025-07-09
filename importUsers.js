const fs = require('fs');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Counter for statistics
const stats = {
  total: 0,
  created: 0,
  skipped: 0,
  errors: 0,
  bySheet: {},
  skipReasons: {
    noCoOp: 0,
    noEmail: 0,
    bothMissing: 0,
    alreadyExists: 0,
    other: 0
  }
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

// Function to process the Excel file
async function importUsers() {
  // Reset stats
  Object.keys(stats).forEach(key => {
    if (typeof stats[key] === 'number') {
      stats[key] = 0;
    } else if (key === 'bySheet') {
      stats.bySheet = {};
    } else if (typeof stats[key] === 'object') {
      Object.keys(stats[key]).forEach(subKey => {
        stats[key][subKey] = 0;
      });
    }
  });

  try {
    console.log('Starting user import process');
    
    // Path to Excel file
    const EXCEL_FILE_PATH = './users.xlsx'; // Fixed path to the xlsx file
    
    // Read the Excel file
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const sheetNames = workbook.SheetNames;
    
    console.log(`Found ${sheetNames.length} sheets in Excel file`);
    
    // Process each sheet
    for (const sheetName of sheetNames) {
      console.log(`\nProcessing sheet: ${sheetName}`);
      
      // Initialize stats for this sheet
      stats.bySheet[sheetName] = {
        total: 0,
        created: 0,
        skipped: 0,
        errors: 0,
        skipReasons: {
          noCoOp: 0,
          noEmail: 0,
          bothMissing: 0,
          alreadyExists: 0,
          other: 0
        }
      };
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const results = xlsx.utils.sheet_to_json(worksheet);
      
      console.log(`Parsed ${results.length} records from sheet ${sheetName}`);
      stats.total += results.length;
      stats.bySheet[sheetName].total = results.length;
      
      // Process each record
      for (const record of results) {
        try {
          // Get field values using our helper function
          const coopField = getFieldValue(record, 'CO-OP');
          const emailField = getFieldValue(record, 'EMAIL');
          const companyName = getFieldValue(record, 'COMPANY NAME');
          const storeName = getFieldValue(record, 'STORE NAME');
          
          // Skip if missing either CO-OP or EMAIL
          const hasCoOp = hasValue(coopField);
          const hasEmail = hasValue(emailField);
          
          if (!hasCoOp && !hasEmail) {
            stats.skipped++;
            stats.skipReasons.bothMissing++;
            stats.bySheet[sheetName].skipped++;
            stats.bySheet[sheetName].skipReasons.bothMissing++;
            continue;
          } else if (!hasCoOp) {
            stats.skipped++;
            stats.skipReasons.noCoOp++;
            stats.bySheet[sheetName].skipped++;
            stats.bySheet[sheetName].skipReasons.noCoOp++;
            continue;
          } else if (!hasEmail) {
            stats.skipped++;
            stats.skipReasons.noEmail++;
            stats.bySheet[sheetName].skipped++;
            stats.bySheet[sheetName].skipReasons.noEmail++;
            continue;
          }
          
          // Normalize the email to avoid duplicate checks failing due to case differences
          const normalizedEmail = String(emailField).toLowerCase().trim();
          
          // Combine address fields
          const address = [
            getFieldValue(record, 'ADDRESS') || '',
            getFieldValue(record, 'CITY') || '',
            getFieldValue(record, 'ST') || '',
            getFieldValue(record, 'ZIP') || ''
          ].filter(Boolean).join(', ');
          
          // Create user object
          const userData = {
            email: normalizedEmail,
            name: (storeName || companyName || 'Member').trim(),
            businessName: companyName || 'Business Name Not Provided',
            contactPerson: getFieldValue(record, 'CONTACT') || 'Contact Not Provided',
            address: address || 'Address Not Provided',
            fax: getFieldValue(record, 'FAX') || '',
            phone: getFieldValue(record, 'PHONE') || '',
            role: 'member', // Set role to "member" if CO-OP field has value
            password: '$2b$10$Vmn9Vm1DeFrhEP/GpYuFBeA3ymAK.VoAw5NyMbS8Vij1P.nHD4TWa', // default password: "changeme123"
            isVerified: true // Set users as verified
          };
          
          // Check if user already exists
          const existingUser = await User.findOne({ email: userData.email });
          if (existingUser) {
            console.log(`User with email ${userData.email} already exists. Skipping.`);
            stats.skipped++;
            stats.skipReasons.alreadyExists++;
            stats.bySheet[sheetName].skipped++;
            stats.bySheet[sheetName].skipReasons.alreadyExists++;
            continue;
          }
          
          // Create the user
          const user = new User(userData);
          await user.save();
          console.log(`Created user: ${userData.email}`);
          stats.created++;
          stats.bySheet[sheetName].created++;
        } catch (error) {
          console.error(`Error processing record:`, error);
          stats.errors++;
          stats.skipReasons.other++;
          stats.bySheet[sheetName].errors++;
          stats.bySheet[sheetName].skipReasons.other++;
        }
      }
    }
    
    // Print summary
    console.log('\n======= IMPORT COMPLETED =======');
    console.log(`Total records across all sheets: ${stats.total}`);
    console.log(`Users created: ${stats.created}`);
    console.log(`Records skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    return {
      success: true,
      stats: {
        total: stats.total,
        created: stats.created,
        skipped: stats.skipped,
        errors: stats.errors,
        skipReasons: stats.skipReasons
      }
    };
  } catch (error) {
    console.error('Error processing Excel file:', error);
    return { success: false, error: error.message };
  }
}

// Export the function for use in routes
module.exports = { importUsers };

// If script is run directly, execute the import
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }).then(async () => {
    console.log('MongoDB connected successfully');
    await importUsers();
    mongoose.connection.close();
    console.log('Database connection closed');
  }).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
} 