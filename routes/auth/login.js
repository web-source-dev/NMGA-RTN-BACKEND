const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const Log = require('../../models/Logs'); // Add this line to require the Logs model
const Announcement = require('../../models/Announcments'); // Add this line to require the Announcement model
const { sendAuthMessage } = require('../../utils/message');
const { createNotification } = require('../Common/Notification');

router.post('/', async (req, res) => {
    const { email, password, login_key, adminId } = req.body;

    try {
        // First check if it's a main user
        let user = await User.findOne({ email: email.toLowerCase() });
        let isCollaborator = false;
        let collaboratorData = null;
        let mainUser = null;

        // If not found in main users, check collaborators
        if (!user) {
            const usersWithCollaborators = await User.find({
                'collaborators.email': email.toLowerCase()
            });

            for (const userDoc of usersWithCollaborators) {
                const collaborator = userDoc.collaborators.find(
                    collab => collab.email.toLowerCase() === email.toLowerCase()
                );
                
                if (collaborator && collaborator.status === 'active') {
                    isCollaborator = true;
                    collaboratorData = collaborator;
                    mainUser = userDoc;
                    break;
                }
            }

            if (!isCollaborator) {
                return res.status(400).json({ message: 'Invalid email or password' });
            }
        }

        // Handle collaborator login
        if (isCollaborator) {
            if (collaboratorData.status !== 'active') {
                return res.status(403).json({ message: 'Collaborator account is not active' });
            }

            const isPasswordMatch = await bcrypt.compare(password, collaboratorData.password);
            if (!isPasswordMatch) {
                return res.status(400).json({ message: 'Invalid email or password' });
            }

            // Create token for collaborator with main user's role and collaborator's role
            const tokenPayload = {
                id: mainUser._id, // Main user's ID
                role: mainUser.role, // Main user's role
                collaboratorId: collaboratorData._id,
                collaboratorRole: collaboratorData.role,
                isCollaborator: true,
                collaboratorEmail: collaboratorData.email
            };

            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1y' });

            // Create login notification for main user
            await createNotification({
                recipientId: mainUser._id,
                type: 'auth',
                subType: 'collaborator_login',
                title: 'Collaborator Login',
                message: `${collaboratorData.name} logged in to your account`,
                relatedId: collaboratorData._id,
                onModel: 'User',
                priority: 'medium'
            });

            // Fetch announcements for login event
            const announcements = await Announcement.find({
                event: 'login',
                isActive: true,
                startTime: { $lte: new Date() },
                endTime: { $gte: new Date() }
            }).sort({ priority: -1, createdAt: -1 });

            return res.json({
                token,
                user: {
                    id: mainUser._id,
                    name: mainUser.name,
                    email: mainUser.email,
                    role: mainUser.role,
                    businessName: mainUser.businessName,
                    contactPerson: mainUser.contactPerson,
                    phone: mainUser.phone,
                    address: mainUser.address,
                    logo: mainUser.logo,
                    isCollaborator: true,
                    collaboratorName: collaboratorData.name,
                    collaboratorRole: collaboratorData.role
                },
                user_id: mainUser._id,
                message: 'Collaborator login successful',
                success: true,
                announcements
            });
        }

        // Handle main user login
        if (user.isBlocked) {
            return res.status(403).json({ message: 'User is blocked' });
        }
        // Check if email is verified (skip for admin login with login_key)
        if (!user.isVerified && !login_key) {
            return res.status(403).json({ 
                message: 'Email not verified. Please verify your email before logging in.',
                needsVerification: true,
                userId: user._id,
                email: user.email
            });
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

        // Generate token based on login type
        let tokenPayload = { 
          id: user._id, 
          role: user.role 
        };

        // If admin is logging in as another user using login_key, include impersonation info
        if (isLoginKeyMatch && adminId) {
          // This is admin logging in as another user
          tokenPayload = {
            id: user._id, // The user being impersonated
            role: user.role, // The user's role
            impersonatedUserId: user._id, // The user being impersonated
            isImpersonating: true,
            adminId: adminId // The admin's ID who is doing the impersonation
          };
        }

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1y' });

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
