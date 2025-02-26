const baseTemplate = require('./baseTemplate');

module.exports = (name, resetLink) => baseTemplate(`
    <h2>Password Reset Request</h2>
    <p>Dear ${name},</p>

    <p>We received a request to reset your password for your NMGA account. To proceed with the password reset, click the button below:</p>

    <a href="${resetLink}" class="button">Reset Password</a>

    <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 5px;">
        <p style="margin: 0; color: #856404;">
            <strong>Security Notice:</strong> If you didn't request this password reset, please:
            <ul>
                <li>Ignore this email</li>
                <li>Ensure your account password is secure</li>
                <li>Contact our support team if you have concerns</li>
            </ul>
        </p>
    </div>

    <p>This password reset link will expire in 1 hour for security purposes.</p>
`);
