// migrateDeals.js
// Script to migrate existing deals from the old schema to the new schema structure.
// Usage: set MONGO_URI in your environment (e.g., in a .env file), then run:
//   node migrateDeals.js

require('dotenv').config();
const mongoose = require('mongoose');
const Deal = require('./models/Deals'); // Adjust the path if your Deal model is in a different directory

async function migrate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Match all deals that still have the old 'size', 'originalCost', and 'discountPrice' fields
    const query = { size: { $exists: true } };

    // Use an aggregation pipeline update (MongoDB 4.2+)
    const updatePipeline = [
      {
        $set: {
          // Create the new 'sizes' array from the old fields
          sizes: [{
            size: '$size',
            originalCost: '$originalCost',
            discountPrice: '$discountPrice'
          }],
          // Initialize discountTiers to an empty array
          discountTiers: []
        }
      },
      {
        // Remove the old fields
        $unset: ['size', 'originalCost', 'discountPrice']
      }
    ];

    // Perform the update
    const result = await Deal.updateMany(query, updatePipeline);
    console.log(`Matched ${result.matchedCount} documents, Modified ${result.modifiedCount} documents`);

    // Disconnect when done
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrate();
