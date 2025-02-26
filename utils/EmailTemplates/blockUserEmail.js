const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Account Access Suspended</h2>
    <p>Dear ${name},</p>

    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: #856404; margin: 0;">
            <strong>Important Notice:</strong> Your account has been temporarily blocked.
        </p>
    </div>

    <p>This action may have been taken due to:</p>
    <ul>
        <li>Violation of our terms of service</li>
        <li>Suspicious account activity</li>
        <li>Multiple failed login attempts</li>
        <li>System detected security concerns</li>
    </ul>

    <p>To restore your account access, please:</p>
    <ol>
        <li>Contact our support team</li>
        <li>Verify your identity</li>
        <li>Review and address any violations</li>
    </ol>

    <a href="${FRONTEND_URL}/support" class="button">Contact Support</a>
`);
