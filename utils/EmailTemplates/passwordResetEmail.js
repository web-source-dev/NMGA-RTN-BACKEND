const baseTemplate = require('./baseTemplate');

module.exports = (name, resetLink) => baseTemplate(`
    <h2>Password Reset Request</h2>
    <p>Dear ${name},</p>

    <p>We received a request to reset your password for your NMGA account. To proceed with the password reset, click the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button">Reset Password</a>
    </div>

    <div class="alert-box alert-warning">
        <p style="margin: 0;">
            <strong>Security Notice:</strong> If you didn't request this password reset, please:
        </p>
        <ul>
            <li>Ignore this email</li>
            <li>Ensure your account password is secure</li>
            <li>Contact our support team if you have concerns</li>
        </ul>
    </div>

    <p>This password reset link will expire in 1 hour for security purposes.</p>
`);
