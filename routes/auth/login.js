const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Log = require('../../models/Logs'); // Add this line to require the Logs model
const sendEmail = require('../../utils/email');
const loginEmail = require('../../utils/EmailTemplates/loginEmail');
const Announcement = require('../../models/Announcments'); // Add this line to require the Announcement model
const { sendAuthMessage } = require('../../utils/message');
const { createNotification } = require('../Common/Notification');

router.post('/', async (req, res) => {
    const { email, password, login_key } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ message: 'User is blocked' });
        }

        let isPasswordMatch = false;
        if (password) {
            isPasswordMatch = await bcrypt.compare(password, user.password);
        }
        const isLoginKeyMatch = login_key && login_key === user.login_key;
        if (!isPasswordMatch && !isLoginKeyMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Create login notification
        await createNotification({
            recipientId: user._id,
            type: 'auth',
            subType: 'login',
            title: 'New Login',
            message: `New login detected from ${req.headers['user-agent'] || 'Unknown Device'}`,
            relatedId: user._id,
            onModel: 'User',
            priority: 'medium'
        });

        // If admin login, notify them about any pending items
        if (user.role === 'admin') {
            // You can add additional notifications for admin here
            // For example, pending commitments, new users, etc.
        }

        // Log the login attempt if login_key is used
        if (isLoginKeyMatch) {
            const log = new Log({
                message: `Administrative override: System administrator performed privileged access to ${user.name}'s account`,
                type: 'warning',
                user_id: user._id
            });
            await log.save();
        }
        if (isPasswordMatch) {
            const log = new Log({
                message: `Authentication successful: ${user.name} accessed the system with valid credentials`,
                type: 'success',
                user_id: user._id
            });
            await log.save();
        }

        // Check user role
        if (user.role !== 'member' && user.role !== 'distributor' && user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const loginEmailData = {
            name: user.name,
            time: new Date().toLocaleString(),
            location: req.ip || 'Unknown',
            device: req.headers['user-agent'] || 'Unknown'
        };

        const emailContent = loginEmail(loginEmailData);
        await sendEmail(user.email, 'New Login Detected', emailContent);

        if (user.phone) {
            const userInfo = {
                name: user.name,
                time: new Date().toLocaleString(),
                location: req.ip || 'Unknown',
                device: req.headers['user-agent'] || 'Unknown'
            };
            
            try {
                await sendAuthMessage.login(user.phone, userInfo);
            } catch (error) {
                console.error('SMS sending failed:', error);
                // Continue with login process even if SMS fails
            }
        }

        // Fetch announcements for login event
        const announcements = await Announcement.find({
            event: 'login',
            isActive: true,
            startTime: { $lte: new Date() },
            endTime: { $gte: new Date() }
        }).sort({ priority: -1, createdAt: -1 });

        res.json({ 
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                businessName: user.businessName,
                contactPerson: user.contactPerson,
                phone: user.phone,
                address: user.address,
                logo: user.logo
            },
            user_id: user._id,
            message: 'Login successful',
            success: true,
            announcements
        });
    } catch (error) {
        console.error('Server error:', error); // Add this line to log the error
        res.status(500).json({ message: 'Server error, please try again', success: false });
    }
});

module.exports = router;
