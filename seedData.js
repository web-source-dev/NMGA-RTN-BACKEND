const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Deal = require('./models/Deals');
const Commitment = require('./models/Commitments');
const Announcement = require('./models/Announcments');
const Compare = require('./models/Compare');
const ContactUs = require('./models/contactus');
const SplashPage = require('./models/SplashPage');
const Supplier = require('./models/Suppliers');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nmga-rtn')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Clear existing data
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Deal.deleteMany({});
    await Commitment.deleteMany({});
    await Announcement.deleteMany({});
    await Compare.deleteMany({});
    await ContactUs.deleteMany({});
    await SplashPage.deleteMany({});
    await Supplier.deleteMany({});
    console.log('Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

// Seed data function
const seedData = async () => {
  try {
    // Hash for password (same for all users for development)
    const hashedPassword = await bcrypt.hash('Password123', 10);
    
    // Create users (admin, distributors, members)
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      businessName: 'NMGA Admin',
      contactPerson: 'John Admin',
      phone: '555-123-4567',
      address: '123 Admin St, Admin City, AC 12345',
      isVerified: true
    });

    const distributor1 = await User.create({
      name: 'Distributor One',
      email: 'distributor1@example.com',
      password: hashedPassword,
      role: 'distributor',
      businessName: 'First Distribution Co.',
      contactPerson: 'Jane Distributor',
      phone: '555-234-5678',
      fax: '555-234-5679',
      address: '456 Distributor Ave, Dist City, DC 23456',
      logo: 'https://via.placeholder.com/150',
      isVerified: true
    });

    const distributor2 = await User.create({
      name: 'Distributor Two',
      email: 'distributor2@example.com',
      password: hashedPassword,
      role: 'distributor',
      businessName: 'Second Distribution Co.',
      contactPerson: 'Jack Distributor',
      phone: '555-345-6789',
      address: '789 Distributor Blvd, Dist Town, DT 34567',
      isVerified: true
    });

    // Create members
    const members = [];
    for (let i = 1; i <= 10; i++) {
      const member = await User.create({
        name: `Member ${i}`,
        email: `member${i}@example.com`,
        password: hashedPassword,
        role: 'member',
        businessName: `Business ${i}`,
        contactPerson: `Contact Person ${i}`,
        phone: `555-${100 + i}-${1000 + i}`,
        address: `${i}00 Member St, Member City, MC ${10000 + i}`,
        isVerified: true,
        // For some members, set them as added by distributor1
        ...(i <= 5 && { addedBy: distributor1._id })
      });
      members.push(member);
    }

    // Update distributor1 with addedMembers
    await User.findByIdAndUpdate(distributor1._id, {
      $push: { addedMembers: { $each: members.slice(0, 5).map(m => m._id) } }
    });

    // Create suppliers
    const suppliers = [];
    for (let i = 1; i <= 3; i++) {
      const supplier = await Supplier.create({
        name: `Supplier ${i}`,
        email: `supplier${i}@example.com`,
        assignedTo: [members[i-1]._id, members[i]._id],
        assignedBy: distributor1._id,
        assignedAt: new Date()
      });
      suppliers.push(supplier);
    }

    // Create deals
    const deals = [];
    const categories = ['Vegetables', 'Fruits', 'Dairy', 'Meat', 'Bakery'];
    const sizeOptions = ['Small', 'Medium', 'Large', 'Extra Large'];
    
    for (let i = 1; i <= 8; i++) {
      const distributor = i % 2 === 0 ? distributor1 : distributor2;
      const dealStartAt = new Date();
      const dealEndsAt = new Date();
      dealEndsAt.setDate(dealEndsAt.getDate() + 14); // 2 weeks from now
      
      const sizes = [];
      const numSizes = Math.floor(Math.random() * 3) + 1; // 1 to 3 sizes
      
      for (let j = 0; j < numSizes; j++) {
        const originalCost = 100 + Math.floor(Math.random() * 900); // 100 to 999
        const discountPrice = originalCost * 0.8; // 20% discount
        
        sizes.push({
          size: sizeOptions[j],
          originalCost,
          discountPrice,
          discountTiers: [
            { tierQuantity: 5, tierDiscount: discountPrice * 0.95 }, // 5% additional discount
            { tierQuantity: 10, tierDiscount: discountPrice * 0.9 }, // 10% additional discount
          ]
        });
      }

      const deal = await Deal.create({
        name: `Deal ${i}: ${categories[i % categories.length]} Special`,
        description: `This is a special deal for ${categories[i % categories.length].toLowerCase()}.`,
        sizes,
        distributor: distributor._id,
        category: categories[i % categories.length],
        status: 'active',
        dealStartAt,
        dealEndsAt,
        minQtyForDiscount: 5,
        images: [`https://via.placeholder.com/300?text=Deal${i}`],
      });
      deals.push(deal);
    }

    // Create commitments
    const commitments = [];
    for (let i = 0; i < members.length; i++) {
      // Each member commits to 1-3 deals
      const numCommitments = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < numCommitments; j++) {
        const dealIndex = (i + j) % deals.length;
        const deal = deals[dealIndex];
        
        // Select 1-2 sizes from the deal
        const sizeCommitments = [];
        const numSizeCommitments = Math.min(deal.sizes.length, Math.floor(Math.random() * 2) + 1);
        let totalPrice = 0;
        
        for (let k = 0; k < numSizeCommitments; k++) {
          const dealSize = deal.sizes[k];
          const quantity = Math.floor(Math.random() * 10) + 1; // 1 to 10
          let pricePerUnit = dealSize.discountPrice;
          
          // Apply tier discount if applicable
          let appliedDiscountTier = { tierQuantity: null, tierDiscount: null };
          for (const tier of dealSize.discountTiers) {
            if (quantity >= tier.tierQuantity) {
              pricePerUnit = tier.tierDiscount;
              appliedDiscountTier = {
                tierQuantity: tier.tierQuantity,
                tierDiscount: tier.tierDiscount
              };
            }
          }
          
          const itemTotalPrice = pricePerUnit * quantity;
          totalPrice += itemTotalPrice;
          
          sizeCommitments.push({
            size: dealSize.size,
            quantity,
            pricePerUnit,
            totalPrice: itemTotalPrice,
            appliedDiscountTier
          });
        }
        
        const status = ['pending', 'approved', 'declined', 'cancelled'][Math.floor(Math.random() * 2)]; // More weight to pending and approved
        
        const commitment = await Commitment.create({
          userId: members[i]._id,
          dealId: deal._id,
          sizeCommitments,
          totalPrice,
          status,
          paymentStatus: status === 'approved' ? 'paid' : 'pending'
        });
        
        commitments.push(commitment);
        
        // Update deal with commitment
        await Deal.findByIdAndUpdate(deal._id, {
          $push: { commitments: commitment._id }
        });
        
        // Update user with committed deal
        await User.findByIdAndUpdate(members[i]._id, {
          $push: { committedDeals: commitment._id }
        });
      }
    }

    // Create Compare entries
    for (let i = 0; i < 3; i++) {
      const deal = deals[i];
      const dealCommitments = commitments.filter(c => c.dealId.toString() === deal._id.toString());
      
      if (dealCommitments.length > 0) {
        const comparisonItems = [];
        let totalCommittedQuantity = 0;
        let totalActualQuantity = 0;
        let totalCommittedPrice = 0;
        let totalActualPrice = 0;
        let quantityDifferenceTotal = 0;
        let priceDifferenceTotal = 0;
        
        for (const commitment of dealCommitments) {
          for (const sizeCommitment of commitment.sizeCommitments) {
            const actualQuantity = Math.floor(sizeCommitment.quantity * (0.8 + Math.random() * 0.4)); // 80-120% of committed
            const actualPrice = sizeCommitment.pricePerUnit * (0.9 + Math.random() * 0.2); // 90-110% of committed
            
            const quantityDiff = actualQuantity - sizeCommitment.quantity;
            const priceDiff = (actualPrice - sizeCommitment.pricePerUnit) * actualQuantity;
            
            totalCommittedQuantity += sizeCommitment.quantity;
            totalActualQuantity += actualQuantity;
            totalCommittedPrice += sizeCommitment.totalPrice;
            totalActualPrice += actualPrice * actualQuantity;
            quantityDifferenceTotal += quantityDiff;
            priceDifferenceTotal += priceDiff;
            
            comparisonItems.push({
              memberId: commitment.userId,
              memberName: members.find(m => m._id.toString() === commitment.userId.toString()).name,
              commitmentId: commitment._id,
              size: sizeCommitment.size,
              committedQuantity: sizeCommitment.quantity,
              actualQuantity,
              committedPrice: sizeCommitment.pricePerUnit,
              actualPrice,
              quantityDifference: quantityDiff,
              priceDifference: priceDiff
            });
          }
        }
        
        await Compare.create({
          dealId: deal._id,
          distributorId: deal.distributor,
          dealName: deal.name,
          fileName: `comparison_${deal._id}.xlsx`,
          comparisonItems,
          summary: {
            totalCommittedQuantity,
            totalActualQuantity,
            totalCommittedPrice,
            totalActualPrice,
            quantityDifferenceTotal,
            priceDifferenceTotal
          }
        });
      }
    }

    // Create announcements
    const eventTypes = [
      'login', 'signup', 'admin_dashboard', 'distributor_dashboard', 
      'procurement_dashboard', 'deal_management', 'user_management', 'analytics'
    ];
    
    for (let i = 1; i <= 5; i++) {
      const startTime = new Date();
      const endTime = new Date();
      endTime.setDate(endTime.getDate() + 7); // 1 week duration
      
      await Announcement.create({
        title: `Announcement ${i}`,
        content: `This is announcement number ${i}. It contains important information for users.`,
        author: i % 2 === 0 ? admin._id : distributor1._id,
        category: ['General', 'Event', 'Update'][i % 3],
        tags: [`tag${i}`, 'important'],
        isActive: true,
        priority: ['Low', 'Medium', 'High'][i % 3],
        event: eventTypes[i % eventTypes.length],
        startTime,
        endTime
      });
    }

    // Create contact us entries
    for (let i = 0; i < 5; i++) {
      const user = i % 2 === 0 ? members[i] : distributor1;
      
      await ContactUs.create({
        user_id: user._id,
        user_role: user.role,
        name: user.name,
        email: user.email,
        subject: `Support Request ${i+1}`,
        message: `This is a sample support request message ${i+1}. Please help with this issue.`,
        status: i < 3 ? 'pending' : 'resolved'
      });
    }

    // Create splash pages
    for (let i = 1; i <= 3; i++) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14); // 2 weeks duration
      
      const cards = [];
      const numCards = Math.floor(Math.random() * 3) + 1; // 1-3 cards
      
      for (let j = 1; j <= numCards; j++) {
        cards.push({
          title: `Card ${j} Title`,
          subheading: `Card ${j} Subheading`,
          content: `This is the content for card ${j} of splash page ${i}.`,
          media: [
            {
              type: 'image',
              url: `https://via.placeholder.com/600x400?text=Splash${i}-Card${j}`
            }
          ],
          ctaButtons: [
            {
              text: 'Learn More',
              link: '/learn-more',
              analytics: {
                clicks: Math.floor(Math.random() * 100),
                uniqueClicks: Math.floor(Math.random() * 50),
                clickHistory: []
              }
            }
          ]
        });
      }
      
      const splashPage = await SplashPage.create({
        cards,
        displaySettings: {
          displayType: ['modal', 'fullscreen', 'banner'][i % 3],
          animation: 'fade',
          navigationStyle: 'slider',
          autoPlay: i % 2 === 0
        },
        scheduling: {
          startDate,
          endDate,
          showOnlyOnce: false,
          frequency: 'daily',
          daysOfWeek: [0, 1, 2, 3, 4],
          timeOfDay: {
            start: '09:00',
            end: '17:00'
          }
        },
        targeting: {
          userRoles: i === 1 ? ['all'] : (i === 2 ? ['member'] : ['distributor'])
        },
        analytics: {
          views: Math.floor(Math.random() * 1000),
          uniqueViews: Math.floor(Math.random() * 500),
          closeRate: Math.random(),
          totalCloses: Math.floor(Math.random() * 300)
        },
        isActive: true,
        createdBy: admin._id
      });
      
      // Add as favorite for some users
      if (i === 1) {
        await User.findByIdAndUpdate(members[0]._id, {
          $push: { favorites: splashPage._id }
        });
        
        await User.findByIdAndUpdate(members[1]._id, {
          $push: { favorites: splashPage._id }
        });
      }
    }

    console.log('Database seeded successfully');
    return { admin, distributors: [distributor1, distributor2], members, deals, commitments };
    
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// Main execution
const runSeed = async () => {
  try {
    await clearDatabase();
    const { admin, distributors, members, deals, commitments } = await seedData();
    
    console.log(`
=== Seeding Complete ===
Created:
- 1 Admin (email: admin@example.com)
- 2 Distributors (emails: distributor1@example.com, distributor2@example.com)
- 10 Members (emails: member1@example.com through member10@example.com)
- 8 Deals (with various sizes and discount tiers)
- Multiple Commitments (linking members to deals)
- Compare data for 3 deals
- 5 Announcements
- 5 Contact requests
- 3 Splash pages (with various cards and settings)
- 3 Suppliers (assigned to members)

All passwords are set to: Password123
    `);
    
    process.exit(0);
  } catch (err) {
    console.error('Failed to run seed:', err);
    process.exit(1);
  }
};

runSeed(); 