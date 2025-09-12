const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Account Access Restored</h2>
    <p>Dear ${name},</p>

    <div class="alert-box alert-success">
        <p style="margin: 0;">
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

    <div class="alert-box alert-info">
        <p><strong>Security Recommendations:</strong></p>
        <ul>
            <li>Update your password</li>
            <li>Review your account settings</li>
            <li>Enable two-factor authentication</li>
        </ul>
    </div>

    <div style="text-align: center; margin-top: 20px;">
        <a href="${FRONTEND_URL}/login" class="button">Login Now</a>
    </div>
`);
