const mongoose = require('mongoose');
const Deal = require('../models/Deals');
const User = require('../models/User');
const Commitment = require('../models/Commitments');
require('dotenv').config();

// Helper function to create dates relative to current time
const createDate = (daysFromNow, hours = 0, minutes = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Helper function to create dates in the past
const createPastDate = (daysAgo, hours = 0, minutes = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const seedReminderTestData = async () => {
  try {
    console.log('🌱 Starting reminder system test data seeding...');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');


    // Clear existing test users
    await User.deleteMany({});
    await Deal.deleteMany({});
    await Commitment.deleteMany({});
    
    console.log('🧹 Cleared existing test users');

    // Create test users
    console.log('👥 Creating test users...');
    
    // Create distributors
    const distributors = await Promise.all([
      User.findOneAndUpdate(
        { email: 'distributor1@test.com' },
        {
          name: 'Test Distributor 1',
          email: 'distributor1@test.com',
          role: 'distributor',
          businessName: 'ABC Distribution Co.',
          phone: '+15551234567',
          isBlocked: false,
          isVerified: true
        },
        { upsert: true, new: true }
      ),
      User.findOneAndUpdate(
        { email: 'distributor2@test.com' },
        {
          name: 'Test Distributor 2',
          email: 'distributor2@test.com',
          role: 'distributor',
          businessName: 'XYZ Supply Chain',
          phone: '+15551234568',
          isBlocked: false,
          isVerified: true
        },
        { upsert: true, new: true }
      )
    ]);

    // Create members
    const members = await Promise.all([
      User.findOneAndUpdate(
        { email: 'member1@test.com' },
        {
          name: 'Test Member 1',
          email: 'member1@test.com',
          role: 'member',
          businessName: 'Member Store 1',
          phone: '+15551234569',
          isBlocked: false,
          isVerified: true
        },
        { upsert: true, new: true }
      ),
      User.findOneAndUpdate(
        { email: 'member2@test.com' },
        {
          name: 'Test Member 2',
          email: 'member2@test.com',
          role: 'member',
          businessName: 'Member Store 2',
          phone: '+15551234570',
          isBlocked: false,
          isVerified: true
        },
        { upsert: true, new: true }
      ),
      User.findOneAndUpdate(
        { email: 'member3@test.com' },
        {
          name: 'Test Member 3',
          email: 'member3@test.com',
          role: 'member',
          businessName: 'Member Store 3',
          phone: '+15551234571',
          isBlocked: false,
          isVerified: true
        },
        { upsert: true, new: true }
      )
    ]);

    console.log('✅ Test users created');

    // Clear existing test deals
    await Deal.deleteMany({ 
      name: { $regex: /^TEST_/ } 
    });
    console.log('🧹 Cleared existing test deals');

    // ============================================================================
    // DISTRIBUTOR POSTING DEADLINE REMINDERS TEST DATA
    // ============================================================================
    console.log('📅 Creating distributor posting deadline reminder test data...');

    // 1. Deal that needs 5-day posting reminder (commitment window starts in 5 days)
    await Deal.create({
      name: 'TEST_5_DAYS_POSTING_REMINDER',
      description: 'Test deal for 5-day posting reminder',
      category: 'Electronics',
      distributor: distributors[0]._id,
      status: 'inactive', // Not posted yet
      commitmentStartAt: createDate(5, 9, 0), // 5 days from now at 9 AM
      commitmentEndsAt: createDate(12, 17, 0), // 12 days from now at 5 PM
      dealStartAt: createDate(13, 9, 0), // 13 days from now
      dealEndsAt: createDate(20, 17, 0), // 20 days from now
      sizes: [{
        size: 'Standard',
        originalCost: 100,
        discountPrice: 80,
        discountTiers: [
          { tierQuantity: 10, tierDiscount: 75 },
          { tierQuantity: 25, tierDiscount: 70 }
        ]
      }],
      minQtyForDiscount: 5
    });

    // 2. Deal that needs 3-day posting reminder (commitment window starts in 3 days)
    await Deal.create({
      name: 'TEST_3_DAYS_POSTING_REMINDER',
      description: 'Test deal for 3-day posting reminder',
      category: 'Food & Beverage',
      distributor: distributors[1]._id,
      status: 'inactive', // Not posted yet
      commitmentStartAt: createDate(3, 9, 0), // 3 days from now at 9 AM
      commitmentEndsAt: createDate(10, 17, 0), // 10 days from now at 5 PM
      dealStartAt: createDate(11, 9, 0), // 11 days from now
      dealEndsAt: createDate(18, 17, 0), // 18 days from now
      sizes: [{
        size: 'Bulk',
        originalCost: 50,
        discountPrice: 40,
        discountTiers: [
          { tierQuantity: 20, tierDiscount: 35 },
          { tierQuantity: 50, tierDiscount: 30 }
        ]
      }],
      minQtyForDiscount: 10
    });

    // 3. Deal that needs 1-day posting reminder (commitment window starts in 1 day)
    await Deal.create({
      name: 'TEST_1_DAY_POSTING_REMINDER',
      description: 'Test deal for 1-day posting reminder',
      category: 'Office Supplies',
      distributor: distributors[0]._id,
      status: 'inactive', // Not posted yet
      commitmentStartAt: createDate(1, 9, 0), // 1 day from now at 9 AM
      commitmentEndsAt: createDate(8, 17, 0), // 8 days from now at 5 PM
      dealStartAt: createDate(9, 9, 0), // 9 days from now
      dealEndsAt: createDate(16, 17, 0), // 16 days from now
      sizes: [{
        size: 'Pack of 100',
        originalCost: 25,
        discountPrice: 20,
        discountTiers: [
          { tierQuantity: 50, tierDiscount: 18 },
          { tierQuantity: 100, tierDiscount: 15 }
        ]
      }],
      minQtyForDiscount: 25
    });

    // ============================================================================
    // DISTRIBUTOR APPROVAL REMINDERS TEST DATA
    // ============================================================================
    console.log('✅ Creating distributor approval reminder test data...');

    // 4. Deal that needs approval reminder (commitment window ended 5 days ago, has commitments)
    const approvalDeal = await Deal.create({
      name: 'TEST_APPROVAL_REMINDER',
      description: 'Test deal for approval reminder',
      category: 'Health & Beauty',
      distributor: distributors[1]._id,
      status: 'active', // Posted but needs approval
      commitmentStartAt: createPastDate(12, 9, 0), // 12 days ago
      commitmentEndsAt: createPastDate(5, 17, 0), // 5 days ago (triggers approval reminder)
      dealStartAt: createDate(5, 9, 0), // 5 days from now
      dealEndsAt: createDate(12, 17, 0), // 12 days from now
      sizes: [{
        size: 'Standard',
        originalCost: 75,
        discountPrice: 60,
        discountTiers: [
          { tierQuantity: 15, tierDiscount: 55 },
          { tierQuantity: 30, tierDiscount: 50 }
        ]
      }],
      minQtyForDiscount: 8
    });

    // Create commitments for the approval reminder deal
    const commitments = await Promise.all([
      Commitment.create({
        userId: members[0]._id,
        dealId: approvalDeal._id,
        sizeCommitments: [{
          size: 'Standard',
          quantity: 10,
          pricePerUnit: 60,
          totalPrice: 600
        }],
        totalPrice: 600,
        status: 'pending'
      }),
      Commitment.create({
        userId: members[1]._id,
        dealId: approvalDeal._id,
        sizeCommitments: [{
          size: 'Standard',
          quantity: 15,
          pricePerUnit: 55,
          totalPrice: 825
        }],
        totalPrice: 825,
        status: 'pending'
      })
    ]);

    // Update the deal with commitments
    await Deal.findByIdAndUpdate(approvalDeal._id, {
      commitments: commitments.map(c => c._id)
    });

    // ============================================================================
    // MEMBER COMMITMENT WINDOW OPENING REMINDERS TEST DATA
    // ============================================================================
    console.log('📅 Creating member window opening reminder test data...');

    // 5. Deal for member window opening reminder (commitment window starts tomorrow)
    await Deal.create({
      name: 'TEST_MEMBER_WINDOW_OPENING',
      description: 'Test deal for member window opening reminder',
      category: 'Home & Garden',
      distributor: distributors[0]._id,
      status: 'active', // Posted and ready
      commitmentStartAt: createDate(1, 9, 0), // Tomorrow at 9 AM
      commitmentEndsAt: createDate(8, 17, 0), // 8 days from now at 5 PM
      dealStartAt: createDate(9, 9, 0), // 9 days from now
      dealEndsAt: createDate(16, 17, 0), // 16 days from now
      sizes: [{
        size: 'Large',
        originalCost: 200,
        discountPrice: 160,
        discountTiers: [
          { tierQuantity: 5, tierDiscount: 150 },
          { tierQuantity: 10, tierDiscount: 140 }
        ]
      }],
      minQtyForDiscount: 3
    });

    // ============================================================================
    // MEMBER COMMITMENT WINDOW CLOSING REMINDERS TEST DATA
    // ============================================================================
    console.log('⏰ Creating member window closing reminder test data...');

    // 6. Deal for 5-day closing reminder
    await Deal.create({
      name: 'TEST_MEMBER_5_DAYS_CLOSING',
      description: 'Test deal for 5-day closing reminder',
      category: 'Automotive',
      distributor: distributors[1]._id,
      status: 'active',
      commitmentStartAt: createPastDate(3, 9, 0), // 3 days ago
      commitmentEndsAt: createDate(5, 17, 0), // 5 days from now at 5 PM
      dealStartAt: createDate(6, 9, 0), // 6 days from now
      dealEndsAt: createDate(13, 17, 0), // 13 days from now
      sizes: [{
        size: 'Standard',
        originalCost: 150,
        discountPrice: 120,
        discountTiers: [
          { tierQuantity: 8, tierDiscount: 110 },
          { tierQuantity: 15, tierDiscount: 100 }
        ]
      }],
      minQtyForDiscount: 5
    });

    // 7. Deal for 3-day closing reminder
    await Deal.create({
      name: 'TEST_MEMBER_3_DAYS_CLOSING',
      description: 'Test deal for 3-day closing reminder',
      category: 'Sports & Recreation',
      distributor: distributors[0]._id,
      status: 'active',
      commitmentStartAt: createPastDate(5, 9, 0), // 5 days ago
      commitmentEndsAt: createDate(3, 17, 0), // 3 days from now at 5 PM
      dealStartAt: createDate(4, 9, 0), // 4 days from now
      dealEndsAt: createDate(11, 17, 0), // 11 days from now
      sizes: [{
        size: 'Medium',
        originalCost: 80,
        discountPrice: 65,
        discountTiers: [
          { tierQuantity: 12, tierDiscount: 60 },
          { tierQuantity: 25, tierDiscount: 55 }
        ]
      }],
      minQtyForDiscount: 6
    });

    // 8. Deal for 1-day closing reminder
    await Deal.create({
      name: 'TEST_MEMBER_1_DAY_CLOSING',
      description: 'Test deal for 1-day closing reminder',
      category: 'Books & Media',
      distributor: distributors[1]._id,
      status: 'active',
      commitmentStartAt: createPastDate(7, 9, 0), // 7 days ago
      commitmentEndsAt: createDate(1, 17, 0), // 1 day from now at 5 PM
      dealStartAt: createDate(2, 9, 0), // 2 days from now
      dealEndsAt: createDate(9, 17, 0), // 9 days from now
      sizes: [{
        size: 'Set of 5',
        originalCost: 40,
        discountPrice: 32,
        discountTiers: [
          { tierQuantity: 20, tierDiscount: 30 },
          { tierQuantity: 40, tierDiscount: 28 }
        ]
      }],
      minQtyForDiscount: 10
    });

    // 9. Deal for 1-hour closing reminder
    await Deal.create({
      name: 'TEST_MEMBER_1_HOUR_CLOSING',
      description: 'Test deal for 1-hour closing reminder',
      category: 'Clothing & Accessories',
      distributor: distributors[0]._id,
      status: 'active',
      commitmentStartAt: createPastDate(8, 9, 0), // 8 days ago
      commitmentEndsAt: createDate(0, 18, 0), // Today at 6 PM (1 hour from now if run at 5 PM)
      dealStartAt: createDate(1, 9, 0), // 1 day from now
      dealEndsAt: createDate(8, 17, 0), // 8 days from now
      sizes: [{
        size: 'One Size',
        originalCost: 60,
        discountPrice: 48,
        discountTiers: [
          { tierQuantity: 15, tierDiscount: 45 },
          { tierQuantity: 30, tierDiscount: 42 }
        ]
      }],
      minQtyForDiscount: 8
    });

    // ============================================================================
    // MEMBER COMMITMENT STATUS TEST DATA
    // ============================================================================
    console.log('📊 Creating member commitment status test data...');

    // Create some commitments for the closing reminder deals to test different scenarios
    const closingDeal5Days = await Deal.findOne({ name: 'TEST_MEMBER_5_DAYS_CLOSING' });
    const closingDeal3Days = await Deal.findOne({ name: 'TEST_MEMBER_3_DAYS_CLOSING' });
    const closingDeal1Day = await Deal.findOne({ name: 'TEST_MEMBER_1_DAY_CLOSING' });

    // Member 1 has commitments (will get different messaging)
    await Promise.all([
      Commitment.create({
        userId: members[0]._id,
        dealId: closingDeal5Days._id,
        sizeCommitments: [{
          size: 'Standard',
          quantity: 8,
          pricePerUnit: 110,
          totalPrice: 880
        }],
        totalPrice: 880,
        status: 'pending'
      }),
      Commitment.create({
        userId: members[0]._id,
        dealId: closingDeal3Days._id,
        sizeCommitments: [{
          size: 'Medium',
          quantity: 12,
          pricePerUnit: 60,
          totalPrice: 720
        }],
        totalPrice: 720,
        status: 'pending'
      })
    ]);

    // Member 2 has no commitments (will get different messaging)
    // Member 3 has no commitments (will get different messaging)

    // Update deals with commitments
    await Promise.all([
      Deal.findByIdAndUpdate(closingDeal5Days._id, {
        $push: { commitments: (await Commitment.findOne({ userId: members[0]._id, dealId: closingDeal5Days._id }))._id }
      }),
      Deal.findByIdAndUpdate(closingDeal3Days._id, {
        $push: { commitments: (await Commitment.findOne({ userId: members[0]._id, dealId: closingDeal3Days._id }))._id }
      })
    ]);

    // ============================================================================
    // COMMITMENT NOTIFICATION TEST DATA
    // ============================================================================
    console.log('📧 Creating commitment notification test data...');

    // Create a deal with commitments that can be approved/declined for testing notifications
    const notificationDeal = await Deal.create({
      name: 'TEST_COMMITMENT_NOTIFICATIONS',
      description: 'Test deal for commitment notifications',
      category: 'Tools & Hardware',
      distributor: distributors[1]._id,
      status: 'active',
      commitmentStartAt: createPastDate(10, 9, 0), // 10 days ago
      commitmentEndsAt: createPastDate(3, 17, 0), // 3 days ago
      dealStartAt: createDate(2, 9, 0), // 2 days from now
      dealEndsAt: createDate(9, 17, 0), // 9 days from now
      sizes: [{
        size: 'Professional',
        originalCost: 300,
        discountPrice: 240,
        discountTiers: [
          { tierQuantity: 3, tierDiscount: 220 },
          { tierQuantity: 6, tierDiscount: 200 }
        ]
      }],
      minQtyForDiscount: 2
    });

    // Create commitments for notification testing
    const notificationCommitments = await Promise.all([
      Commitment.create({
        userId: members[0]._id,
        dealId: notificationDeal._id,
        sizeCommitments: [{
          size: 'Professional',
          quantity: 3,
          pricePerUnit: 220,
          totalPrice: 660
        }],
        totalPrice: 660,
        status: 'pending'
      }),
      Commitment.create({
        userId: members[1]._id,
        dealId: notificationDeal._id,
        sizeCommitments: [{
          size: 'Professional',
          quantity: 6,
          pricePerUnit: 200,
          totalPrice: 1200
        }],
        totalPrice: 1200,
        status: 'pending'
      }),
      Commitment.create({
        userId: members[2]._id,
        dealId: notificationDeal._id,
        sizeCommitments: [{
          size: 'Professional',
          quantity: 2,
          pricePerUnit: 240,
          totalPrice: 480
        }],
        totalPrice: 480,
        status: 'pending'
      })
    ]);

    // Update the deal with commitments
    await Deal.findByIdAndUpdate(notificationDeal._id, {
      commitments: notificationCommitments.map(c => c._id)
    });

    console.log('✅ All test data created successfully!');
    console.log('\n📋 Test Data Summary:');
    console.log('====================');
    console.log('👥 Users Created:');
    console.log('  - 2 Distributors (with phone numbers)');
    console.log('  - 3 Members (with phone numbers)');
    console.log('\n📅 Distributor Posting Reminders:');
    console.log('  - TEST_5_DAYS_POSTING_REMINDER (commitment starts in 5 days)');
    console.log('  - TEST_3_DAYS_POSTING_REMINDER (commitment starts in 3 days)');
    console.log('  - TEST_1_DAY_POSTING_REMINDER (commitment starts in 1 day)');
    console.log('\n✅ Distributor Approval Reminders:');
    console.log('  - TEST_APPROVAL_REMINDER (commitment ended 5 days ago, has 2 pending commitments)');
    console.log('\n📅 Member Window Opening Reminders:');
    console.log('  - TEST_MEMBER_WINDOW_OPENING (commitment starts tomorrow)');
    console.log('\n⏰ Member Window Closing Reminders:');
    console.log('  - TEST_MEMBER_5_DAYS_CLOSING (commitment ends in 5 days)');
    console.log('  - TEST_MEMBER_3_DAYS_CLOSING (commitment ends in 3 days)');
    console.log('  - TEST_MEMBER_1_DAY_CLOSING (commitment ends in 1 day)');
    console.log('  - TEST_MEMBER_1_HOUR_CLOSING (commitment ends in 1 hour)');
    console.log('\n📧 Commitment Notifications:');
    console.log('  - TEST_COMMITMENT_NOTIFICATIONS (has 3 pending commitments for approval/decline testing)');
    console.log('\n🎯 Testing Scenarios:');
    console.log('  - Member 1: Has commitments (will get "review commitments" messaging)');
    console.log('  - Member 2 & 3: No commitments (will get "make commitments" messaging)');
    console.log('\n⚡ Next Steps:');
    console.log('  1. Run the reminder functions manually or via cron');
    console.log('  2. Check email/SMS delivery');
    console.log('  3. Verify database tracking');
    console.log('  4. Test approval/decline notifications');

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
};

// Run the seeding function
if (require.main === module) {
  seedReminderTestData();
}

module.exports = seedReminderTestData;
