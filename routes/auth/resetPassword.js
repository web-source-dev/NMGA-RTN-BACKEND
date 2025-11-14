const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../utils/email');
const passwordChangedEmail = require('../../utils/EmailTemplates/passwordChangedEmail');
const { logSystemAction } = require('../../utils/collaboratorLogger');

router.post('/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const { type } = req.query; // Check if it's a collaborator reset

  try {
    let user = null;
    let isCollaborator = false;
    let collaboratorData = null;
    let collaboratorIndex = -1;

    if (type === 'collaborator') {
      // Handle collaborator password reset
      // Find users with collaborators that have this token
      const usersWithCollaborators = await User.find({
        'collaborators.resetPasswordToken': token
      });

      for (const userDoc of usersWithCollaborators) {
        const collaborator = userDoc.collaborators.find(
          collab => collab.resetPasswordToken === token && 
                    collab.resetPasswordExpires && 
                    collab.resetPasswordExpires > Date.now()
        );
        
        if (collaborator) {
          isCollaborator = true;
          collaboratorData = collaborator;
          user = userDoc;
          collaboratorIndex = userDoc.collaborators.findIndex(
            collab => collab.resetPasswordToken === token
          );
          break;
        }
      }

      if (!isCollaborator || !user) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
      }

      // Update collaborator's password
      const hashedPassword = await bcrypt.hash(password, 10);
      user.collaborators[collaboratorIndex].password = hashedPassword;
      user.collaborators[collaboratorIndex].resetPasswordToken = undefined;
      user.collaborators[collaboratorIndex].resetPasswordExpires = undefined;
      await user.save();

      // Send response first to prevent headers issue
      res.status(200).json({ message: 'Password has been reset.' });

      // Perform logging and email sending asynchronously
      setImmediate(async () => {
        try {
          // Log the action
          await logSystemAction('password_reset_successful', 'authentication', {
            message: `Password reset successful for collaborator: ${collaboratorData.name} (${collaboratorData.email})`,
            userId: user._id,
            userName: user.name,
            userEmail: collaboratorData.email,
            userRole: 'collaborator',
            resourceId: user._id,
            resourceName: user.name,
            severity: 'medium',
            tags: ['password-reset', 'authentication', 'security', 'collaborator'],
            metadata: {
              collaboratorName: collaboratorData.name,
              collaboratorEmail: collaboratorData.email,
              collaboratorRole: collaboratorData.role,
              mainAccountName: user.name,
              mainAccountEmail: user.email,
              ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
              userAgent: req.headers['user-agent'] || 'Unknown',
              resetMethod: 'token'
            }
          });
          
          const changeDetails = {
            time: new Date().toLocaleString(),
            location: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
            device: req.headers['user-agent'] || 'Unknown'
          };

          const emailContent = passwordChangedEmail(collaboratorData.name, changeDetails);
          await sendEmail(collaboratorData.email, 'Password Changed Successfully', emailContent);
        } catch (error) {
          console.error('Error logging or sending email:', error);
        }
      });
    } else {
      // Handle main user password reset
      user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
      }

      user.password = await bcrypt.hash(password, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      // Send response first to prevent headers issue
      res.status(200).json({ message: 'Password has been reset.' });

      // Perform logging and email sending asynchronously
      setImmediate(async () => {
        try {
          // Log the action
          await logSystemAction('password_reset_successful', 'authentication', {
            message: `Password reset successful: ${user.name} (${user.email})`,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role,
            resourceId: user._id,
            resourceName: user.name,
            severity: 'medium',
            tags: ['password-reset', 'authentication', 'security'],
            metadata: {
              ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
              userAgent: req.headers['user-agent'] || 'Unknown',
              resetMethod: 'token'
            }
          });
          const changeDetails = {
            time: new Date().toLocaleString(),
            location: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
            device: req.headers['user-agent'] || 'Unknown'
          };

          const emailContent = passwordChangedEmail(user.name,changeDetails);
          await sendEmail(user.email, 'Password Changed Successfully', emailContent);
        } catch (error) {
          console.error('Error logging or sending email:', error);
        }
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
