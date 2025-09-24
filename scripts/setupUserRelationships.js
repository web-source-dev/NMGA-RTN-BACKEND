require('dotenv').config();
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { generateUniqueLoginKey } = require("../utils/loginKeyGenerator");

// User relationship data
const userRelationships = [
  {
    mainUser: {
      email: "martin@farmerscountrymarket.com",
      name: "Fenn Group (FCM, La Tienda, Triangle)",
      address: "Roswell",
      contactPerson: "Martin Delgado",
      roleSet: 1,
      phone: "",
      businessName: "Fenn Group (FCM, La Tienda, Triangle)"
    },
    addedMembers: [
      {
        email: "farmers-5@hotmail.com",
        name: "Farmers Country Market #5",
        address: "Roswell",
        contactPerson: "Orlando Mendoza",
        roleSet: 1,
        phone: "",
        businessName: "Farmers Country Market #5"
      },
      {
        email: "fcm391@pvtn.net",
        name: "Farmers Country Market #14",
        address: "Artesia",
        contactPerson: "Miguel Delgado",
        roleSet: 1,
        phone: "",
        businessName: "Farmers Country Market #14"
      },
      {
        email: "fcm483@gmail.com",
        name: "Farmers Country Market #4",
        address: "Roswell",
        contactPerson: "Jesse Rodriguez",
        roleSet: 1,
        phone: "",
        businessName: "Farmers Country Market #4"
      },
      {
        email: "latienda196@outlook.com",
        name: "La Tienda #1",
        address: "Carlsbad",
        contactPerson: "DJ Kellar",
        roleSet: 1,
        phone: "",
        businessName: "La Tienda #1"
      },
      {
        email: "trianglegrocery@comcast.net",
        name: "Triangle Grocery #15",
        address: "Cedar Crest",
        contactPerson: "Ron Sponagel",
        roleSet: 1,
        phone: "",
        businessName: "Triangle Grocery #15"
      }
    ]
  },
  {
    mainUser: {
      email: "breckstewart@qwestoffice.net",
      name: "John Brooks Supermarket",
      address: "Albuquerque",
      contactPerson: "Breck Stewart",
      roleSet: 1,
      phone: "(505) 238-6744",
      businessName: "John Brooks Supermarket"
    },
    addedMembers: [
      {
        email: "jbmanager262@qwestoffice.net",
        name: "John Brooks Supermarket",
        address: "El Dorado",
        contactPerson: "Guy Waldorf",
        roleSet: 1,
        phone: "",
        businessName: "John Brooks Supermarket"
      },
      {
        email: "jbmanager452@qwestoffice.net",
        name: "John Brooks Supermarket",
        address: "Milan",
        contactPerson: "Sandra Chavez",
        roleSet: 1,
        phone: "",
        businessName: "John Brooks Supermarket"
      },
      {
        email: "jbmanager270@qwestoffice.net",
        name: "John Brooks Supermarket",
        address: "Albuquerque",
        contactPerson: "Gabe Michele",
        roleSet: 1,
        phone: "",
        businessName: "John Brooks Supermarket"
      },
      {
        email: "jbmanager268@qwestoffice.net",
        name: "John Brooks Supermarket",
        address: "Socorro",
        contactPerson: "Richard Armijo",
        roleSet: 1,
        phone: "",
        businessName: "John Brooks Supermarket"
      },
      {
        email: "silverstreetmarket@comcast.net",
        name: "Silver Street",
        address: "Albuquerque",
        contactPerson: "Rob & Kelly",
        roleSet: 1,
        phone: "",
        businessName: "Silver Street"
      }
    ]
  },
  {
    mainUser: {
      email: "choselton@buffalothunder.com",
      name: "Pojoaque Kicks 66",
      address: "Pojoaque",
      contactPerson: "Christopher Hoselton",
      roleSet: 1,
      phone: "(505) 501-2099",
      businessName: "Pojoaque Kicks 66"
    },
    addedMembers: [
      {
        email: "troybal@buffalothunder.com",
        name: "Sinclair Kicks 66 Pojoaque",
        address: "Pojoaque",
        contactPerson: "Tia Roybal (Sinclair)",
        roleSet: 1,
        phone: "(505) 231-7059",
        businessName: "Sinclair Kicks 66 Pojoaque"
      }
    ]
  }
];

const setupUserRelationships = async () => {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log("✓ Connected to MongoDB");

    const defaultPassword = "Password123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    let processedRelationships = 0;
    let createdUsers = 0;
    let updatedUsers = 0;
    let errors = 0;

    console.log("Starting to set up user relationships...");

    for (const relationship of userRelationships) {
      try {
        console.log(`\n--- Processing relationship for ${relationship.mainUser.name} ---`);
        
        // Find or create main user
        let mainUser = await User.findOne({ email: relationship.mainUser.email });
        
        if (!mainUser) {
          console.log(`Main user not found: ${relationship.mainUser.email}`);
          console.log(`Creating main user: ${relationship.mainUser.name}`);
          
          const loginKey = await generateUniqueLoginKey(User);
          const userData = {
            name: relationship.mainUser.name,
            email: relationship.mainUser.email,
            password: hashedPassword,
            role: "member",
            roleSet: relationship.mainUser.roleSet,
            businessName: relationship.mainUser.businessName,
            contactPerson: relationship.mainUser.contactPerson,
            phone: relationship.mainUser.phone,
            address: relationship.mainUser.address,
            logo: "",
            isBlocked: false,
            login_key: loginKey,
            isVerified: true
          };

          mainUser = new User(userData);
          await mainUser.save();
          createdUsers++;
          console.log(`✓ Created main user: ${relationship.mainUser.name}`);
        } else {
          console.log(`✓ Found existing main user: ${relationship.mainUser.name}`);
        }

        // Process added members
        const addedMemberIds = [];
        
        for (const memberData of relationship.addedMembers) {
          try {
            let member = await User.findOne({ email: memberData.email });
            
            if (!member) {
              console.log(`Creating missing member: ${memberData.name}`);
              
              const loginKey = await generateUniqueLoginKey(User);
              const userData = {
                name: memberData.name,
                email: memberData.email,
                password: hashedPassword,
                role: "member",
                roleSet: memberData.roleSet,
                businessName: memberData.businessName,
                contactPerson: memberData.contactPerson,
                phone: memberData.phone,
                address: memberData.address,
                logo: "",
                isBlocked: false,
                login_key: loginKey,
                isVerified: true
              };

              member = new User(userData);
              await member.save();
              createdUsers++;
              console.log(`✓ Created member: ${memberData.name}`);
            } else {
              console.log(`✓ Found existing member: ${memberData.name}`);
            }

            // Set up the relationship
            member.addedBy = mainUser._id;
            await member.save();
            
            addedMemberIds.push(member._id);
            console.log(`✓ Set addedBy relationship for ${memberData.name}`);
            
          } catch (error) {
            console.error(`❌ Error processing member ${memberData.name}:`, error.message);
            errors++;
          }
        }

        // Update main user with added members
        mainUser.addedMembers = addedMemberIds;
        await mainUser.save();
        updatedUsers++;
        
        console.log(`✓ Updated main user ${relationship.mainUser.name} with ${addedMemberIds.length} added members`);
        processedRelationships++;

      } catch (error) {
        console.error(`❌ Error processing relationship for ${relationship.mainUser.name}:`, error.message);
        errors++;
      }
    }

    console.log("\n=== Summary ===");
    console.log(`✓ Processed relationships: ${processedRelationships}`);
    console.log(`✓ Created users: ${createdUsers}`);
    console.log(`✓ Updated users: ${updatedUsers}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`\nDefault password for new users: ${defaultPassword}`);

  } catch (error) {
    console.error("❌ Database connection error:", error.message);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed");
    process.exit(0);
  }
};

setupUserRelationships();
