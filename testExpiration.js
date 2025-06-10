const mongoose = require('mongoose');
const checkDealExpiration = require('./utils/dealExpirationCheck');
require('dotenv').config();

async function testExpirationCheck() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
    
    // Run the expiration check
    console.log('Running deal expiration check...');
    await checkDealExpiration();
    
    console.log('Expiration check completed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the test
testExpirationCheck(); 