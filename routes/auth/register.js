const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const sendEmail = require('../../utils/email');
const registerEmail = require('../../utils/EmailTemplates/registerEmail');
const otpEmail = require('../../utils/EmailTemplates/otpEmail');
const Announcement = require('../../models/Announcments');
const { sendAuthMessage } = require('../../utils/message');
const { generateUniqueLoginKey } = require('../../utils/loginKeyGenerator');
const { logSystemAction } = require('../../utils/collaboratorLogger');

// Helper function to generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};


router.post('/', async (req, res) => {
    const { name, email, password, role, businessName, contactPerson, phone } = req.body;
    console.log('data received', req.body);
    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Check if email exists as a collaborator
        const userWithCollaborator = await User.findOne({
            'collaborators.email': email.toLowerCase()
        });
        if (userWithCollaborator) {
            return res.status(400).json({ message: 'Email already exists' });
        }
        const loginKey = await generateUniqueLoginKey(User);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate OTP for email verification
        const otp = generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP expires in 10 minutes

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
            isVerified: false,
            verificationOTP: {
                code: otp,
                expiresAt: otpExpiry
            }
        });

        await newUser.save();

        // Log the action
        await logSystemAction('user_registration', 'user', {
            message: `New registration: ${newUser.name} (${newUser.email}) - ${newUser.role}`,
            userId: newUser._id,
            userName: newUser.name,
            userEmail: newUser.email,
            userRole: newUser.role,
            resourceId: newUser._id,
            resourceName: newUser.name,
            businessName: newUser.businessName,
            contactPerson: newUser.contactPerson,
            severity: 'low',
            tags: ['registration', 'user', 'email-verification-pending'],
            metadata: {
                ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
                userAgent: req.headers['user-agent'] || 'Unknown',
                verificationRequired: true,
                otpSent: true
            }
        });

        // Send verification email with OTP
        const emailContent = otpEmail(newUser.name, otp);
        await sendEmail(newUser.email, 'NMGA Email Verification', emailContent);

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
            message: 'Registration successful! Please check your email for verification code.',
            userId: newUser._id,
            email: newUser.email,
            announcements
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
});

// Verify email with OTP
router.post('/verify-email', async (req, res) => {
    const { userId, otp } = req.body;
    
    try {
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.isVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }
        
        if (!user.verificationOTP || !user.verificationOTP.code) {
            return res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        }
        
        if (new Date() > user.verificationOTP.expiresAt) {
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }
        
        if (user.verificationOTP.code !== otp) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }
        
        // Mark user as verified and clear OTP
        user.isVerified = true;
        user.verificationOTP = undefined;
        await user.save();
        
        // Log successful verification
        await logSystemAction('email_verification_successful', 'authentication', {
            message: `Email verification successful: ${user.name} (${user.email})`,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            resourceId: user._id,
            resourceName: user.name,
            severity: 'low',
            tags: ['email-verification', 'authentication', 'success'],
            metadata: {
                ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
                userAgent: req.headers['user-agent'] || 'Unknown',
                accountActivated: true
            }
        });
        
        // Send welcome email
        const welcomeEmailContent = registerEmail(user.name);
        await sendEmail(user.email, 'Welcome to NMGA', welcomeEmailContent);
        
        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
});

// Resend verification OTP
router.post('/resend-verification', async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        if (user.isVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }
        
        // Generate new OTP
        const otp = generateOTP();
        const otpExpiry = new Date();
        otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP expires in 10 minutes
        
        user.verificationOTP = {
            code: otp,
            expiresAt: otpExpiry
        };
        
        await user.save();
        
        // Send verification email with new OTP
        const emailContent = otpEmail(user.name, otp);
        await sendEmail(user.email, 'NMGA Email Verification', emailContent);
        
        res.status(200).json({ 
            message: 'Verification code resent. Please check your email.',
            userId: user._id,
            email: user.email
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, please try again' });
    }
});

module.exports = router;
