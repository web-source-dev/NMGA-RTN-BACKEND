import mongoose from "mongoose";
import User from "../models/User"; // Add this line to require the User model
import bcrypt from "bcryptjs";

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/NMGA", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const password = "Password123";

const hashedPassword = await bcrypt.hash(password, 10);

// Collaborator data for distributor
const distributorCollaborators = [
  {
    name: "John Smith",
    email: "john.smith@distributor.com",
    role: "manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@distributor.com",
    role: "deal_manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Mike Wilson",
    email: "mike.wilson@distributor.com",
    role: "supplier_manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Lisa Brown",
    email: "lisa.brown@distributor.com",
    role: "media_manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Tom Anderson",
    email: "tom.anderson@distributor.com",
    role: "viewer",
    password: hashedPassword,
    status: "active"
  }
];

// Collaborator data for member
const memberCollaborators = [
  {
    name: "Alice Cooper",
    email: "alice.cooper@member.com",
    role: "manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Fiona Black",
    email: "fiona.black@member.com",
    role: "commitment_manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "George Red",
    email: "george.red@member.com",
    role: "substore_manager",
    password: hashedPassword,
    status: "active"
  },
  {
    name: "Helen Blue",
    email: "helen.blue@member.com",
    role: "viewer",
    password: hashedPassword,
    status: "active"
  }
];

const addCollaborators = async () => {
  try {
    await connectDB();

    // Find the distributor user
    const distributor = await User.findOne({ role: "distributor" });
    if (!distributor) {
      console.log("No distributor found in database");
      return;
    }

    // Find the member user
    const member = await User.findOne({ role: "member" });
    if (!member) {
      console.log("No member found in database");
      return;
    }

    console.log(`Found distributor: ${distributor.name} (${distributor.email})`);
    console.log(`Found member: ${member.name} (${member.email})`);

    // Add collaborators to distributor
    console.log("\nAdding collaborators to distributor...");
    distributor.collaborators = distributorCollaborators;
    await distributor.save();
    console.log(`Added ${distributorCollaborators.length} collaborators to distributor`);

    // Add collaborators to member
    console.log("\nAdding collaborators to member...");
    member.collaborators = memberCollaborators;
    await member.save();
    console.log(`Added ${memberCollaborators.length} collaborators to member`);

    console.log("\n✅ Successfully added collaborators to both users!");
    
    // Display summary
    console.log("\n📊 Summary:");
    console.log(`Distributor (${distributor.name}) now has ${distributor.collaborators.length} collaborators`);
    console.log(`Member (${member.name}) now has ${member.collaborators.length} collaborators`);

    console.log("\n👥 Distributor Collaborators:");
    distributor.collaborators.forEach((collab, index) => {
      console.log(`  ${index + 1}. ${collab.name} (${collab.email}) - ${collab.role}`);
    });

    console.log("\n👥 Member Collaborators:");
    member.collaborators.forEach((collab, index) => {
      console.log(`  ${index + 1}. ${collab.name} (${collab.email}) - ${collab.role}`);
    });

  } catch (error) {
    console.error("Error adding collaborators:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  }
};

// Run the script
addCollaborators();
