const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, changeDetails) => baseTemplate(`
    <h2>Password Successfully Changed</h2>
    <p>Dear ${name},</p>

    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: #155724; margin: 0;">
            <strong>Success!</strong> Your password has been updated.
        </p>
    </div>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>Change Details:</h3>
        <ul>
            <li>Time: ${changeDetails.time}</li>
            <li>Location: ${changeDetails.location}</li>
            <li>Device: ${changeDetails.device}</li>
        </ul>
    </div>

    <p>If you didn't make this change, please:</p>
    <ul>
        <li>Contact our support team immediately</li>
        <li>Review your recent account activity</li>
        <li>Change your password again</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/account/security" class="button">Review Security Settings</a>
    </div>
`);
