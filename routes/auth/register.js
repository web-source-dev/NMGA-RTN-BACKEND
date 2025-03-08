const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Log = require('../../models/Logs'); // Add this line to require the Logs model
const sendEmail = require('../../utils/email');
const registerEmail = require('../../utils/EmailTemplates/registerEmail');
const Announcement = require('../../models/Announcments'); // Add this line to require the Announcement model
const { sendAuthMessage } = require('../../utils/message');

// Helper function to generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to create OTP email template
const otpEmailTemplate = (name, otp) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Email Verification</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering with NMGA. To complete your registration, please use the following verification code:</p>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you did not request this verification, please ignore this email.</p>
        <p>Best regards,<br>NMGA Team</p>
    </div>
    `;
};

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

        const log = new Log({
            message: `New registration initiated: ${newUser.name} registered as ${newUser.role} in the system. Awaiting email verification.`,
            type: 'info',
            user_id: newUser._id
        });
        await log.save();

        // Send verification email with OTP
        const emailContent = otpEmailTemplate(newUser.name, otp);
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
        const log = new Log({
            message: `Email verification complete: ${user.name} successfully verified their email`,
            type: 'success',
            user_id: user._id
        });
        await log.save();
        
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
        const user = await User.findOne({ email });
        
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
        const emailContent = otpEmailTemplate(user.name, otp);
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
