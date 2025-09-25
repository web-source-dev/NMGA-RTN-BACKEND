const User = require('../models/User');
const mongoose = require('mongoose');
require('dotenv').config();


const users = [
    {
      "user": "Estevan Lujan",
      "time": "2025-09-25T01:39:31.000Z"
    },
    {
      "user": "Henry Varela",
      "time": "2025-09-25T01:05:17.000Z"
    },
    {
      "user": "Guy Waldorf",
      "time": "2025-09-25T00:22:19.000Z"
    },
    {
      "user": "Ron Brown",
      "time": "2025-09-24T23:05:39.000Z"
    },
    {
      "user": "Fenn Group (FCM, La Tienda, Triangle)",
      "time": "2025-09-24T23:03:35.000Z"
    },
    {
      "user": "Handy Andy",
      "time": "2025-09-24T10:35:41.000Z"
    },
    {
      "user": "Four Winds Travel Center",
      "time": "2025-09-24T06:23:19.000Z"
    },
    {
      "user": "Latitudes",
      "time": "2025-09-24T04:20:55.000Z"
    },
    {
      "user": "Pat's",
      "time": "2025-09-24T03:16:20.000Z"
    },
    {
      "user": "Der Markt Food Store",
      "time": "2025-09-24T02:50:52.000Z"
    },
    {
      "user": "Dino's Hideaway - Off Premise",
      "time": "2025-09-24T02:23:15.000Z"
    },
    {
      "user": "Jubilation Wine & Spirits",
      "time": "2025-09-24T02:19:35.000Z"
    },
    {
      "user": "Silver Street",
      "time": "2025-09-24T02:07:29.000Z"
    },
    {
      "user": "Liquor Barn",
      "time": "2025-09-24T01:47:09.000Z"
    },
    {
      "user": "Shorty's",
      "time": "2025-09-24T01:43:00.000Z"
    }
  ]

const updateLastLogin = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const userNames = users.map(user => user.user);
    const dbUsers = await User.find({ name: { $in: userNames } });
    
    for (let i = 0; i < dbUsers.length; i++) {
        const dbUser = dbUsers[i];
        const userData = users.find(u => u.user === dbUser.name);
        if (userData) {
            dbUser.lastLogin = new Date(userData.time);
            await dbUser.save();
        }
        console.log(`Updated lastLogin for ${dbUser.name}`);
    }
    
    console.log(`Updated lastLogin for ${dbUsers.length} users`);
    
    await mongoose.disconnect();
};

updateLastLogin();