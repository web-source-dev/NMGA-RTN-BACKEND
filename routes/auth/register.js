const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const Log = require('../../models/Logs'); // Add this line to require the Logs model
const sendEmail = require('../../utils/email');
const registerEmail = require('../../utils/EmailTemplates/registerEmail');
const Announcement = require('../../models/Announcments'); // Add this line to require the Announcement model
const { sendAuthMessage } = require('../../utils/message');

router.post('/', async (req, res) => {
    const { name, email, password, role, businessName, contactPerson, phone } = req.body;
    console.log('data received', req.body);
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        const loginKey = Math.floor(100000000000 + Math.random() * 900000000000);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
            login_key: loginKey,
            businessName,
            contactPerson,
            phone,
            address: '',
            logo: '',
        });

        await newUser.save();

        const log = new Log({
            message: `New registration complete: ${newUser.name} successfully registered as ${newUser.role} in the system`,
            type: 'success',
            user_id: newUser._id
        });
        await log.save();

        const emailContent = registerEmail(newUser.name);
        await sendEmail(newUser.email, 'Welcome to NMGA', emailContent);

        if (newUser.phone) {
            const userInfo = {
                name: newUser.name,
                email: newUser.email,
                businessName: newUser.businessName
            };
            
            try {
                await sendAuthMessage.registration(newUser.phone, userInfo);
            } catch (error) {
                console.error('Registration SMS failed:', error);
            }
        }

        // Fetch announcements for signup event
        const announcements = await Announcement.find({
            event: 'signup',
            isActive: true,
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() }
        }).sort({ priority: -1, createdAt: -1 });

        res.status(201).json({ 
            message: 'User registered successfully',
            announcements
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
});

module.exports = router;
