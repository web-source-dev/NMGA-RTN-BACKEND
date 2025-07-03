const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Path to CSV file - update this path as needed
const CSV_FILE_PATH = './user.csv';

// Counter for statistics
const stats = {
  total: 0,
  created: 0,
  skipped: 0,
  errors: 0
};

// Function to process the CSV file
async function importUsers() {
  console.log(`Starting import from ${CSV_FILE_PATH}`);
  
  const results = [];
  
  // Read and parse CSV file
  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`Parsed ${results.length} records from CSV`);
      stats.total = results.length;
      
      // Process each record
      for (const record of results) {
        try {
          // Check if CO-OP field contains "X"
          const coopField = record['CO-OP'] || '';
          if (coopField.trim() !== 'X') {
            console.log(`Skipping record with email ${record.Email || 'N/A'} (CO-OP field is not "X")`);
            stats.skipped++;
            continue;
          }
          
          // Combine address fields
          const address = [
            record.ADDRESS || '',
            record.CITY || '',
            record.ST || '',
            record.ZIP || ''
          ].filter(Boolean).join(', ');
          
          // Create user object
          const userData = {
            email: record.Email?.toLowerCase().trim(),
            name: record['Store Name'] || '',
            businessName: record['Company Name'] || '',
            contactPerson: record.CONTACT || '',
            address: address,
            fax: record.FAX || '',
            // Set role to "member" if CO-OP field is not empty
            role: 'member',
            // Set default password (should be changed on first login)
            password: '$2b$10$Vmn9Vm1DeFrhEP/GpYuFBeA3ymAK.VoAw5NyMbS8Vij1P.nHD4TWa', // default password: "changeme123"
            isVerified: true // Set users as verified
          };
          
          // Check if email is provided
          if (!userData.email) {
            console.log(`Skipping record with no email`);
            stats.skipped++;
            continue;
          }
          
          // Check if user already exists
          const existingUser = await User.findOne({ email: userData.email });
          if (existingUser) {
            console.log(`User with email ${userData.email} already exists. Skipping.`);
            stats.skipped++;
            continue;
          }
          
          // Create the user
          const user = new User(userData);
          await user.save();
          console.log(`Created user: ${userData.email}`);
          stats.created++;
        } catch (error) {
          console.error(`Error processing record:`, error);
          stats.errors++;
        }
      }
      if (results.length > 0) {
        console.log("CSV Headers:", Object.keys(results[0]));
      }
      // Print summary
      console.log('\nImport completed!');
      console.log(`Total records: ${stats.total}`);
      console.log(`Users created: ${stats.created}`);
      console.log(`Records skipped: ${stats.skipped}`);
      console.log(`Errors: ${stats.errors}`);
      
      // Close connection
      mongoose.connection.close();
      console.log('Database connection closed');
    });
}

// Start the import
importUsers(); 