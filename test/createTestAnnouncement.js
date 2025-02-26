const mongoose = require('mongoose');
const Announcement = require('../models/Announcments');

require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const createTestAnnouncement = async () => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const announcement = new Announcement({
      title: 'Test Signup Announcement',
      content: 'This is a test announcement for the signup page',
      category: 'General',
      isActive: true,
      priority: 'High',
      event: 'signup',
      startTime: now,
      endTime: tomorrow
    });

    await announcement.save();
    console.log('Test announcement created successfully');
  } catch (error) {
    console.error('Error creating test announcement:', error);
  } finally {
    mongoose.connection.close();
  }
};

createTestAnnouncement();