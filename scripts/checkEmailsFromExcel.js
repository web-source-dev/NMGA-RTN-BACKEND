require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const User = require('../models/User');

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
})
.then(() => {
  console.log('MongoDB connected successfully');
  checkEmails();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

async function checkEmails() {
  try {
    console.log('Starting email check process...\n');
    
    // Read the Excel file
    const excelFilePath = path.join(__dirname, 'users1.xlsx');
    const workbook = XLSX.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const excelData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Excel file loaded successfully. Found ${excelData.length} rows.\n`);
    
    // Extract emails from Excel
    const excelEmails = excelData.map(row => {
      const email = row.EMAIL || row.email;
      return email ? email.toLowerCase().trim() : null;
    }).filter(email => email !== null);
    
    console.log(`Extracted ${excelEmails.length} valid emails from Excel file.\n`);
    
    // Get all members from database
    const dbMembers = await User.find({ role: 'member' }).select('email');
    const dbEmails = dbMembers.map(user => user.email.toLowerCase().trim());
    
    console.log(`Found ${dbEmails.length} members in database.\n`);
    
    // Find matching emails
    const matchingEmails = excelEmails.filter(email => dbEmails.includes(email));
    const nonMatchingEmails = excelEmails.filter(email => !dbEmails.includes(email));
    
    // Find emails in database but not in Excel
    const dbOnlyEmails = dbEmails.filter(email => !excelEmails.includes(email));
    
    // Calculate totals
    const totalExcelEmails = excelEmails.length;
    const totalDbMembers = dbEmails.length;
    const totalMatching = matchingEmails.length;
    const totalNonMatching = nonMatchingEmails.length;
    const totalDbOnly = dbOnlyEmails.length;
    const grandTotal = totalExcelEmails + totalDbMembers;
    
    // Display results
    console.log('='.repeat(60));
    console.log('EMAIL CHECK RESULTS');
    console.log('='.repeat(60));
    console.log(`Total emails in Excel file: ${totalExcelEmails}`);
    console.log(`Total members in database: ${totalDbMembers}`);
    console.log(`Emails that match (exist in both): ${totalMatching}`);
    console.log(`Emails in Excel but NOT in database: ${totalNonMatching}`);
    console.log(`Emails in database but NOT in Excel: ${totalDbOnly}`);
    console.log(`Grand total (Excel + Database): ${grandTotal}`);
    console.log('='.repeat(60));
    
    // Display matching emails
    if (matchingEmails.length > 0) {
      console.log('\n📧 MATCHING EMAILS (exist in both Excel and Database):');
      console.log('-'.repeat(50));
      matchingEmails.forEach((email, index) => {
        console.log(`${index + 1}. ${email}`);
      });
    }
    
    // Display non-matching emails (in Excel but not in DB)
    if (nonMatchingEmails.length > 0) {
      console.log('\n❌ EMAILS IN EXCEL BUT NOT IN DATABASE:');
      console.log('-'.repeat(50));
      nonMatchingEmails.forEach((email, index) => {
        console.log(`${index + 1}. ${email}`);
      });
    }
    
    // Display database-only emails
    if (dbOnlyEmails.length > 0) {
      console.log('\n🔍 EMAILS IN DATABASE BUT NOT IN EXCEL:');
      console.log('-'.repeat(50));
      dbOnlyEmails.forEach((email, index) => {
        console.log(`${index + 1}. ${email}`);
      });
    }
    
    // Summary statistics
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log('-'.repeat(30));
    console.log(`Match rate: ${((totalMatching / totalExcelEmails) * 100).toFixed(2)}% of Excel emails exist in database`);
    console.log(`Database coverage: ${((totalMatching / totalDbMembers) * 100).toFixed(2)}% of database members are in Excel`);
    
    console.log('\n✅ Email check completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during email check:', error.message);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed.');
    process.exit(0);
  }
}
