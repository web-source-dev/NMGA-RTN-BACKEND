const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Log = require('../../models/Logs');
const sendEmail = require('../../utils/email');
const InvitationEmail = require('../../utils/EmailTemplates/InvitationEmail');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { importUsers } = require('../../scripts/importUsers');
const { generateUniqueLoginKey } = require('../../utils/loginKeyGenerator');
const { logCollaboratorAction } = require('../../utils/collaboratorLogger');

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Import users from Excel file
router.post('/import-users', async (req, res) => {
    try {
        // Check if user is admin
        const userRole = req.headers['user-role'];
        if (userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only administrators can import users' });
        }
        
        // Log the action
        await logCollaboratorAction(req, 'import_data', 'user data import');
        
        // Call the import function
        const result = await importUsers();
        
        // Return response
        if (result.success) {
            res.status(200).json({ 
                success: true, 
                message: 'Users imported successfully', 
                stats: result.stats 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Failed to import users', 
                error: result.error 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during import', 
            error: error.message 
        });
    }
});

router.post('/add-user', async (req, res) => {
    const { name, email, role, businessName } = req.body;
    try {
        // Check if email already exists as a main user
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

        const user = new User({ name, email, role, businessName });
        await user.save();
        
        // Log the action
        await logCollaboratorAction(req, 'create_user', 'user account', {
            targetUserName: name,
            targetUserEmail: email,
            targetUserRole: role,
            additionalInfo: `New ${role} account created`
        });

        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        const loginKey = await generateUniqueLoginKey(User);
        console.log('loginKey', loginKey);
        user.login_key = loginKey;
        await user.save();

        console.log('user', user);

        const emailContent = InvitationEmail(token);
        await sendEmail(email, 'Invitation to NMGA', emailContent);

        res.status(200).json({ message: 'User added successfully' });
    } catch (error) {
        console.error('Error adding user:', error);
        
        // Log the error
        await logCollaboratorAction(req, 'create_user_failed', 'user account', {
            targetUserName: name,
            targetUserEmail: email,
            targetUserRole: role,
            additionalInfo: `Error: ${error.message}`
        });
        
        res.status(500).json({ message: 'Error adding user' });
    }
});

router.post('/create-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Log the action
        await logCollaboratorAction(req, 'setup_password', 'user account', {
            targetUserName: user.name,
            targetUserEmail: user.email,
            additionalInfo: 'Account setup completed'
        });

        res.status(200).json({ message: 'Password has been updated.' });
    } catch (error) {
        console.error('Error creating password:', error);
        
        // Log the error
        await logCollaboratorAction(req, 'setup_password_failed', 'user account', {
            additionalInfo: `Error: ${error.message}`
        });
        
        res.status(500).json({ message: 'Error creating password' });
    }
});

module.exports = router;
