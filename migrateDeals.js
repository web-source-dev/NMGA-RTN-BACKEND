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

// Helper function to get a random date between two dates
function getRandomDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function migrateDealsDateRanges() {
  try {
    console.log('Starting migration of deal date ranges and status...');
    
    // Force current year to be 2024 for the date ranges
    const currentYear = 2025;
    
    // Define date ranges
    const startDateMin = new Date(currentYear, 4, 5); // May 5th (month is 0-indexed)
    const startDateMax = new Date(currentYear, 4, 20); // May 20th
    
    const endDateMin = new Date(currentYear, 5, 10); // June 10th
    const endDateMax = new Date(currentYear, 6, 10); // July 10th
    
    console.log(`Setting date ranges:`);
    console.log(`- Start dates: between ${startDateMin.toDateString()} and ${startDateMax.toDateString()}`);
    console.log(`- End dates: between ${endDateMin.toDateString()} and ${endDateMax.toDateString()}`);
    console.log(`- Setting all deals to 'active' status`);
    
    // Find all deals`
    const deals = await Deal.find({});
    
    console.log(`Found ${deals.length} deals to update`);
    
    let updatedCount = 0;
    
    // Update each deal with random dates in the specified ranges
    for (const deal of deals) {
      const randomStartDate = getRandomDateBetween(startDateMin, startDateMax);
      const randomEndDate = getRandomDateBetween(endDateMin, endDateMax);
      
      // Update both start and end dates for all deals, and set status to active
      await Deal.updateOne(
        { _id: deal._id }, 
        { 
          $set: { 
            dealStartAt: randomStartDate,
            dealEndsAt: randomEndDate,
            status: 'active'
          } 
        }
      );
      updatedCount++;
    }
    
    console.log(`Migration completed successfully!`);
    console.log(`Updated dates and status for ${updatedCount} deals.`);
    
    // Find and log some details about the updated deals for verification
    const updatedDeals = await Deal.find()
      .select('_id name dealStartAt dealEndsAt status')
      .limit(10);
    
    console.log('Sample of updated deals:');
    updatedDeals.forEach(deal => {
      console.log(`- ${deal.name || 'Unnamed deal'} (ID: ${deal._id}):`);
      console.log(`  Start date: ${deal.dealStartAt ? deal.dealStartAt.toDateString() : 'Not set'}`);
      console.log(`  End date: ${deal.dealEndsAt ? deal.dealEndsAt.toDateString() : 'Not set'}`);
      console.log(`  Status: ${deal.status}`);
    });
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

async function migrateDiscountTiersToSizeSpecific() {
  try {
    console.log('Starting removal of global discount tiers...');
    
    // Find all deals with global discountTiers
    const deals = await Deal.find({
      discountTiers: { $exists: true }
    });
    
    console.log(`Found ${deals.length} deals with global discount tiers to remove`);
    
    // Remove global discountTiers from all deals
    const result = await Deal.updateMany(
      { discountTiers: { $exists: true } },
      { $unset: { discountTiers: "" } }
    );
    
    console.log(`Removal completed successfully!`);
    console.log(`Removed global discount tiers from ${result.modifiedCount} out of ${result.matchedCount} deals.`);
    
  } catch (error) {
    console.error('Error during discount tier removal:', error);
  }
}

// Execute the migrations
async function runMigrations() {
  try {
    // Run migrations in sequence
    await migrateDealsDateRanges();
    await migrateDiscountTiersToSizeSpecific();
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error during migrations:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the migrations
runMigrations()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
