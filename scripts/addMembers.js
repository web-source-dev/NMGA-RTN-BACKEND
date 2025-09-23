require('dotenv').config();
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { generateUniqueLoginKey } = require("../utils/loginKeyGenerator");


const members = [
    [
        {
            "name": "Alta #6337",
            "address": "Raton",
            "contactPerson": "Keri Perry",
            "roleSet": 1,
            "phone": "",
            "email": "6337@unitedpacific.com",

        },
        {
            "name": "Avanyu Travel Plaza",
            "address": "Santa Clara",
            "contactPerson": "Brian Kehoe",
            "roleSet": 1,
            "phone": "",
            "email": "brian.kehoe@santaclaran.com"
        },
        {
            "name": "Billy Crews Package",
            "address": "Santa Teresa",
            "contactPerson": "Billy Crews",
            "roleSet": 1,
            "phone": "",
            "email": "billycrews@msn.com"
        },
        {
            "name": "Blackies Liquor",
            "address": "Moriarty",
            "contactPerson": "Avtar \"Andy\" Singh",
            "roleSet": 1,
            "phone": "(505) 908-0474",
            "email": "avtar7315@hotmail.com"
        },
        {
            "name": "Circle C",
            "address": "Espanola",
            "contactPerson": "Avtar \"Andy\" Singh",
            "roleSet": 1,
            "phone": "(505) 908-0474",
            "email": "avtar7315@hotmail.com"
        },
        {
            "name": "Bob's Phillips 66",
            "address": "Santa Rosa",
            "contactPerson": "Roberta Cordova",
            "roleSet": 1,
            "phone": "(505) 259-6109",
            "email": "bobsphillips66@gmail.com"
        },
        {
            "name": "Bullocks Shur-Sav",
            "address": "Truth or Consequences",
            "contactPerson": "Forest Hill",
            "roleSet": 1,
            "phone": "",
            "email": "jforesthill63@gmail.com"
        },
        {
            "name": "C & C Liquors",
            "address": "Chapparal",
            "contactPerson": "Christina Perez",
            "roleSet": 1,
            "phone": "(915) 920-1593",
            "email": "ccinvestmentsllc576@gmail.com"
        },
        {
            "name": "Casa Liquor",
            "address": "Albuquerque",
            "contactPerson": "Heesu Choi",
            "roleSet": 1,
            "phone": "",
            "email": "casaliquor@gmail.com"
        },
        {
            "name": "Cliff's Liquors",
            "address": "Santa Fe",
            "contactPerson": "Harmohinder Vij",
            "roleSet": 1,
            "phone": "(505) 412-2524",
            "email": "hvij@aol.com"
        },
        {
            "name": "Copper Mug",
            "address": "Cuba",
            "contactPerson": "Aparcio Herrera",
            "roleSet": 1,
            "phone": "(505) 252-2013",
            "email": "aparcio@outlook.com"
        },
        {
            "name": "Comanche Fuel Stop",
            "address": "Albuquerque",
            "contactPerson": "Ali",
            "roleSet": 1,
            "phone": "(505) 459-7975",
            "email": "comanchefuelstop@gmail.com"
        },
        {
            "name": "Coors Mini-Mart",
            "address": "Albuquerque",
            "contactPerson": "Aleem Hasham",
            "roleSet": 1,
            "phone": "(501) 256-9687",
            "email": "aleemhasham@yahoo.com"
        },
        {
            "name": "Kelly's - De Arcos",
            "address": "Santa Fe",
            "contactPerson": "James Jo",
            "roleSet": 1,
            "phone": "",
            "email": "kellyinsolana@gmail.com"
        },
        {
            "name": "Der Markt Food Store",
            "address": "Red River",
            "contactPerson": "Rachael Romero",
            "roleSet": 1,
            "phone": "",
            "email": "store655@newmex.com"
        },
        {
            "name": "Dino's Hideaway - Off Premise",
            "address": "Farmington",
            "contactPerson": "Lynette Dates",
            "roleSet": 1,
            "phone": "(505) 592-1317",
            "email": "dinoshideaway405@gmail.com"
        },
        {
            "name": "Dino's Mart #170 (Red Mesa)",
            "address": "Farmington",
            "contactPerson": "Robert Moss",
            "roleSet": 1,
            "phone": "",
            "email": "robertgmoss@me.com"
        },
        {
            "name": "A & E Enterprises",
            "address": "La Mesa",
            "contactPerson": "Ed Hayes",
            "roleSet": 1,
            "phone": "(575) 642-8495",
            "email": "ehayes88005@gmail.com"
        },
        {
            "name": "El Rey Discount Liquor",
            "address": "Espanola",
            "contactPerson": "Jorge Lucero",
            "roleSet": 1,
            "phone": "",
            "email": "espanola.liquorland@gmail.com"
        },
        {
            "name": "Fenn Group (FCM, La Tienda, Triangle)",
            "address": "Roswell",
            "contactPerson": "Martin Delgado",
            "roleSet": 1,
            "phone": "",
            "email": "martin@farmerscountrymarket.com"
        },
        {
            "name": "Farmers Country Market #5",
            "address": "Roswell",
            "contactPerson": "Orlando Mendoza",
            "roleSet": 1,
            "phone": "",
            "email": "farmers-5@hotmail.com"
        },
        {
            "name": "Farmers Country Market #14",
            "address": "Artesia",
            "contactPerson": "Miguel Delgado",
            "roleSet": 1,
            "phone": "",
            "email": "fcm391@pvtn.net"
        },
        {
            "name": "Farmers Country Market #4",
            "address": "Roswell",
            "contactPerson": "Jesse Rodriguez",
            "roleSet": 1,
            "phone": "",
            "email": "fcm483@gmail.com"
        },
        {
            "name": "La Tienda #1",
            "address": "Carlsbad",
            "contactPerson": "DJ Kellar",
            "roleSet": 1,
            "phone": "",
            "email": "latienda196@outlook.com"
        },
        {
            "name": "Triangle Grocery #15",
            "address": "Cedar Crest",
            "contactPerson": "Ron Sponagel",
            "roleSet": 1,
            "phone": "",
            "email": "trianglegrocery@comcast.net"
        },
        {
            "name": "Four Winds Travel Center",
            "address": "Albuquerque",
            "contactPerson": "Gary Loy",
            "roleSet": 1,
            "phone": "",
            "email": "gloy@indianpueblo.com"
        },
        {
            "name": "Freeway Liquors",
            "address": "Albuquerque",
            "contactPerson": "Ali",
            "roleSet": 1,
            "phone": "",
            "email": "freewayliquors505@gmail.com"
        },
        {
            "name": "Grants Chevron",
            "address": "Grants",
            "contactPerson": "Jazzy Sandhu",
            "roleSet": 1,
            "phone": "",
            "email": "87chevron@gmail.com"
        },
        {
            "name": "Handy Andy",
            "address": "Grants",
            "contactPerson": "Melinda Salazar",
            "roleSet": 1,
            "phone": "(505) 240-1388",
            "email": "mdsllcgrants@gmail.com"
        },
        {
            "name": "Hilltop Bottle Shop",
            "address": "Clovis",
            "contactPerson": "Kyle Brewer",
            "roleSet": 1,
            "phone": "(575) 791-2597",
            "email": "kbrewer@shopsands.com"
        },
        {
            "name": "Isleta Travel Centers",
            "address": "Isleta",
            "contactPerson": "Howard Naholowa'a",
            "roleSet": 1,
            "phone": "(505) 280-4335",
            "email": "howard.naholowa'a@isleta.com"
        },
        {
            "name": "John Brooks Supermarket",
            "address": "Albuquerque",
            "contactPerson": "Breck Stewart",
            "roleSet": 1,
            "phone": "(505) 238-6744",
            "email": "breckstewart@qwestoffice.net"
        },
        {
            "name": "John Brooks Supermarket",
            "address": "El Dorado",
            "contactPerson": "Guy Waldorf",
            "roleSet": 1,
            "phone": "",
            "email": "jbmanager262@qwestoffice.net"
        },
        {
            "name": "John Brooks Supermarket",
            "address": "Milan",
            "contactPerson": "Sandra Chavez",
            "roleSet": 1,
            "phone": "",
            "email": "jbmanager452@qwestoffice.net"
        },
        {
            "name": "John Brooks Supermarket",
            "address": "Albuquerque",
            "contactPerson": "Gabe Michele",
            "roleSet": 1,
            "phone": "",
            "email": "jbmanager270@qwestoffice.net"
        },
        {
            "name": "John Brooks Supermarket",
            "address": "Socorro",
            "contactPerson": "Richard Armijo",
            "roleSet": 1,
            "phone": "",
            "email": "jbmanager268@qwestoffice.net"
        },
        {
            "name": "Silver Street",
            "address": "Albuquerque",
            "contactPerson": "Rob & Kelly",
            "roleSet": 1,
            "phone": "",
            "email": "silverstreetmarket@comcast.net"
        },
        {
            "name": "Jubilation Wine & Spirits",
            "address": "Albuquerque",
            "contactPerson": "Tasha Armijo",
            "roleSet": 1,
            "phone": "",
            "email": "therealjubilation@yahoo.com"
        },
        {
            "name": "Kaune's Neighborhood Market",
            "address": "Santa Fe",
            "contactPerson": "Leah",
            "roleSet": 1,
            "phone": "",
            "email": "leah@kaunes.com"
        },
        {
            "name": "Kelly's Liquors",
            "address": "",
            "contactPerson": "Kyler Choi",
            "roleSet": 1,
            "phone": "(505) 699-2849",
            "email": "kyuho105@gmail.com"
        },
        {
            "name": "Kelly's Liquors #2 & #4",
            "address": "Albuquerque",
            "contactPerson": "Jin Park",
            "roleSet": 1,
            "phone": "(562) 480-1016",
            "email": "kelly.liquor@gmail.com"
        },
        {
            "name": "Kelly's Liquors #17",
            "address": "Las Cruces",
            "contactPerson": "Mandy Apodaca",
            "roleSet": 1,
            "phone": "",
            "email": "kellyliquorlascruces@gmail.com"
        },
        {
            "name": "Kelly's Liquors #6",
            "address": "Belen",
            "contactPerson": "Perry Sang Lee",
            "roleSet": 1,
            "phone": "(714) 392-7978",
            "email": "kellysinbelen@gmail.com"
        },
        {
            "name": "Kelly's Liquors BF",
            "address": "Bosque Farms",
            "contactPerson": "Perry Sang Lee",
            "roleSet": 1,
            "phone": "(714) 392-7978",
            "email": "kellysinbsqf@gmail.com"
        },
        {
            "name": "Kelly's Liquor Gun Club",
            "address": "Albuquerque",
            "contactPerson": "(Leo) Chanhyeong Oh",
            "roleSet": 1,
            "phone": "(505) 615-4578",
            "email": "ohch4312@gmail.com"
        },
        {
            "name": "Kokoman Fine Liquors",
            "address": "Pojoaque",
            "contactPerson": "Keith Obermaier",
            "roleSet": 1,
            "phone": "",
            "email": "kokoman@cybermesa.com"
        },
        {
            "name": "La Luz Market",
            "address": "La Luz",
            "contactPerson": "Ronnie Merrill",
            "roleSet": 1,
            "phone": "(575) 437-0846",
            "email": "laluzmarket@hotmail.com"
        },
        {
            "name": "Latitudes",
            "address": "Rio Rancho",
            "contactPerson": "Austin Brown",
            "roleSet": 1,
            "phone": "(505) 263-8820",
            "email": "abrown@golatitudes.com"
        },
        {
            "name": "Leger's Package Liquor",
            "address": "Las Vegas",
            "contactPerson": "Frank Leger",
            "roleSet": 1,
            "phone": "(505) 429-1635",
            "email": "fleger@fastmail.com"
        },
        {
            "name": "Liquid Company",
            "address": "Santa Fe",
            "contactPerson": "Greg Anaya",
            "roleSet": 1,
            "phone": "(505) 470-6432",
            "email": "greg-a-anaya@cybermesa.com"
        },
        {
            "name": "Liquor Barn",
            "address": "Santa Fe",
            "contactPerson": "Yvonne Jo-Almeida",
            "roleSet": 1,
            "phone": "",
            "email": "kellyliquorbarn@gmail.com"
        },
        {
            "name": "Lone Butte General Store",
            "address": "Santa Fe",
            "contactPerson": "Satnam Bhandal",
            "roleSet": 1,
            "phone": "",
            "email": "lonebuttegeneralstore@outlook.com"
        },
        {
            "name": "Midtown Market & Spirits",
            "address": "Arroyo Hondo",
            "contactPerson": "Greg Trujillo",
            "roleSet": 1,
            "phone": "",
            "email": "greg@midtownhondo.com"
        },
        {
            "name": "Mike's Place",
            "address": "Albuquerque",
            "contactPerson": "Abdul Jiwani",
            "roleSet": 1,
            "phone": "",
            "email": "jiwaniabdul@hotmail.com"
        },
        {
            "name": "Pat's",
            "address": "Elephant Butte",
            "contactPerson": "Vicki Casas",
            "roleSet": 1,
            "phone": "(817) 304-4006",
            "email": "vicki@patsnewmexico.com"
        },
        {
            "name": "Paradise Liquor",
            "address": "Albuquerque",
            "contactPerson": "Luke Park",
            "roleSet": 1,
            "phone": "",
            "email": "saintkd68@yahoo.com"
        },
        {
            "name": "Pic Quik #22",
            "address": "Las Cruces",
            "contactPerson": "Jo Ortega",
            "roleSet": 1,
            "phone": "(575) 805-3939",
            "email": "jojoross@live.com"
        },
        {
            "name": "Peppers Super Market",
            "address": "Deming",
            "contactPerson": "Mark Schultze",
            "roleSet": 1,
            "phone": "",
            "email": "peppersgrocery@hotmail.com"
        },
        {
            "name": "Pojoaque Kicks 66 / Sinclair",
            "address": "Pojoaque",
            "contactPerson": "Christopher Hoselton",
            "roleSet": 1,
            "phone": "(505) 501-2099",
            "email": "choselton@buffalothunder.com"
        },
        {
            "name": "Pojoaque Supermarket/Jake's Liquor",
            "address": "Pojoaque",
            "contactPerson": "Ray Sandoval",
            "roleSet": 1,
            "phone": "(505) 231-8413",
            "email": "rsandoval@buffalothunder.com"
        },
        {
            "name": "Quality Liquor Store",
            "address": "Roswell",
            "contactPerson": "Sean Davis",
            "roleSet": 1,
            "phone": "(575) 317-5661",
            "email": "davis.seanc@gmail.com"
        },
        {
            "name": "Rodeo Plaza Liquors",
            "address": "Santa Fe",
            "contactPerson": "Kathleen Ortiz",
            "roleSet": 1,
            "phone": "",
            "email": "rodeoplazaliquors@hotmail.com"
        },
        {
            "name": "Ski Hi Bar & Package",
            "address": "Albuquerque",
            "contactPerson": "Chris Chronis",
            "roleSet": 1,
            "phone": "",
            "email": "skihibar@gmail.com"
        },
        {
            "name": "Shorty's",
            "address": "Mesilla",
            "contactPerson": "Brian Johnston",
            "roleSet": 1,
            "phone": "(575) 993-1372",
            "email": "luckyslcnm@gmail.com"
        },
        {
            "name": "SIMM, Inc",
            "address": "Las Cruces",
            "contactPerson": "Vishnu Govindar",
            "roleSet": 1,
            "phone": "(575) 650-1853",
            "email": "simminc@aol.com"
        },
        {
            "name": "The Sportsman - Off Premise",
            "address": "Navajo Dam",
            "contactPerson": "Sonya Keenom",
            "roleSet": 1,
            "phone": "",
            "email": "thesportsman.nm@hotmail.com"
        },
        {
            "name": "Mainstreet Market (Sunmart #675)",
            "address": "Vado",
            "contactPerson": "Jim Kaden",
            "roleSet": 1,
            "phone": "",
            "email": "jkaden@petroleSetumwholesale.com"
        },
        {
            "name": "Lefty's (Toot-nTotem)",
            "address": "Clayton",
            "contactPerson": "Rick Deton",
            "roleSet": 1,
            "phone": "",
            "email": "rdeaton@tootntotum.com"
        },
        {
            "name": "Toucan Market",
            "address": "Las Cruces",
            "contactPerson": "Rob Baur",
            "roleSet": 1,
            "phone": "",
            "email": "tmarket@uniquefoodsnm.com"
        },
        {
            "name": "Village Stop & Go",
            "address": "Questa",
            "contactPerson": "Bernadine Trujillo",
            "roleSet": 1,
            "phone": "",
            "email": "trujillo.berna@gmail.com"
        }
    ]
];

const distributors = [
    {
        "name": "RNDC",
        "contactPerson": "Rick Adams",
        "email": "Rick.Adams@RNDC-USA.com",
        "phone": "(505) 363-6274",
        "address": "",
    },
    {
        "name": "SGWS",
        "contactPerson": "Rick Sanchez",
        "email": "RickSanchez@SGWS.com",
        "phone": "(505) 259-9404",
        "address": "",
    },
    {
        "name": "Admiral Beverage",
        "contactPerson": "Henry Sandoval",
        "phone": "(505) 459-4924",
        "email": "henry.sandoval@admiralbeverage.com",
        "address": "",
    }
];



const addMembers = async () => {
    try {
        // Connect to MongoDB
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
        });
        console.log("✓ Connected to MongoDB");

        const defaultPassword = "Password123";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        console.log("Starting to add members to database...");
        console.log(`Default password for all users: ${defaultPassword}`);

        for (const member of members) {
            for (const memberData of member) {
                try {
                    // Generate unique login key
                    const loginKey = await generateUniqueLoginKey(User);

                    // Create user with all required fields
                    const userData = {
                        name: memberData.name,
                        email: memberData.email,
                        password: hashedPassword,
                        role: "member",
                        roleSet: memberData.roleSet || 1,
                        businessName: memberData.name, // business name is same as name
                        contactPerson: memberData.contactPerson,
                        phone: memberData.phone || "",
                        address: memberData.address || "",
                        logo: "",
                        isBlocked: false,
                        login_key: loginKey,
                        isVerified: true
                    };

                    const user = new User(userData);
                    await user.save();

                    console.log(`✓ Created user: ${memberData.name} (${memberData.email})`);
                    createdCount++;

                } catch (error) {
                    console.error(`❌ Error creating user ${memberData.name}:`, error.message);
                    errorCount++;
                }
            }
        }

        // Add distributors
        for (const distributorData of distributors) {  // Remove the nested loop
            try {
                // Generate unique login key
                const loginKey = await generateUniqueLoginKey(User);

                // Create user with all required fields
                const userData = {
                    name: distributorData.name,
                    email: distributorData.email,
                    password: hashedPassword,
                    role: "distributor",
                    roleSet: 1,  // Set default roleSet
                    businessName: distributorData.name,
                    contactPerson: distributorData.contactPerson,
                    phone: distributorData.phone || "",
                    address: distributorData.address || "",
                    logo: "",
                    isBlocked: false,
                    login_key: loginKey,
                    isVerified: true
                };

                const user = new User(userData);
                await user.save();

                console.log(`✓ Created user: ${distributorData.name} (${distributorData.email})`);
                createdCount++;

            } catch (error) {
                console.error(`❌ Error creating user ${distributorData.name}:`, error.message);
                errorCount++;
            }
        }

        console.log("\n=== Summary ===");
        console.log(`Total processed: ${createdCount + skippedCount + errorCount}`);
        console.log(`✓ Created: ${createdCount}`);
        console.log(`⏭️  Skipped (already exist): ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`\nDefault password for all users: ${defaultPassword}`);
        console.log("All users are verified and not blocked.");

    } catch (error) {
        console.error("❌ Database connection error:", error.message);
    } finally {
        // Close the database connection
        await mongoose.connection.close();
        console.log("✓ Database connection closed");
        process.exit(0);
    }
};

addMembers();

