const mongoose = require('mongoose');
const Deal = require('./models/Deals');
require('dotenv').config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function migrateDealsStartDate() {
  try {
    console.log('Starting migration of missing dealStartAt dates...');
    
    // Create the target date (April 20th of current year)
    const currentYear = new Date().getFullYear();
    const targetDate = new Date(currentYear, 3, 20); // Month is 0-indexed (3 = April)
    
    // Find all deals where dealStartAt is undefined, null, or doesn't exist
    const result = await Deal.updateMany(
      { 
        $or: [
          { dealStartAt: { $exists: false } },
          { dealStartAt: null }
        ] 
      },
      { 
        $set: { dealStartAt: targetDate } 
      }
    );
    
    console.log(`Migration completed successfully!`);
    console.log(`Updated ${result.modifiedCount} out of ${result.matchedCount} deals.`);
    
    // Find and log some details about the updated deals for verification
    const updatedDeals = await Deal.find(
      { dealStartAt: targetDate }
    ).select('_id name dealStartAt dealEndsAt').limit(10);
    
    console.log('Sample of updated deals:');
    updatedDeals.forEach(deal => {
      console.log(`- ${deal.name || 'Unnamed deal'} (ID: ${deal._id}): Start date set to ${deal.dealStartAt.toDateString()}`);
    });
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Execute the migration
migrateDealsStartDate()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
