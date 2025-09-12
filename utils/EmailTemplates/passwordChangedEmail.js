const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, changeDetails) => baseTemplate(`
    <h2>Password Successfully Changed</h2>
    <p>Dear ${name},</p>

    <div class="alert-box alert-success">
        <p style="margin: 0;">
            <strong>Success!</strong> Your password has been updated.
        </p>
    </div>

    <div class="card">
        <h3 class="card-header">Change Details:</h3>
        <ul>
            <li>Time: ${changeDetails.time}</li>
            <li>Location: ${changeDetails.location}</li>
            <li>Device: ${changeDetails.device}</li>
        </ul>
    </div>

    <div class="alert-box alert-warning">
        <p><strong>If you didn't make this change, please:</strong></p>
        <ul>
            <li>Contact our support team immediately</li>
            <li>Review your recent account activity</li>
            <li>Change your password again</li>
        </ul>
    </div>
`);
