const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Account Access Restored</h2>
    <p>Dear ${name},</p>

    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: #155724; margin: 0;">
            <strong>Good News!</strong> Your account has been successfully unblocked.
        </p>
    </div>

    <p>You can now:</p>
    <ul>
        <li>Log in to your account</li>
        <li>Access all platform features</li>
        <li>Participate in deals</li>
        <li>View your commitments</li>
    </ul>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Security Recommendations:</strong></p>
        <ul>
            <li>Update your password</li>
            <li>Review your account settings</li>
            <li>Enable two-factor authentication</li>
        </ul>
    </div>

    <a href="${FRONTEND_URL}/login" class="button">Login Now</a>
`);
