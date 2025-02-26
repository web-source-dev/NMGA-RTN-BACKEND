const baseTemplate = require('./baseTemplate');

module.exports = (name) => baseTemplate(`
    <h2>Account Deletion Confirmation</h2>
    <p>Dear ${name},</p>

    <p>We're sorry to see you go. Your account has been successfully deleted from our system.</p>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>What This Means:</h3>
        <ul>
            <li>All your personal data has been removed</li>
            <li>Active commitments have been cancelled</li>
            <li>Your membership has been terminated</li>
        </ul>
    </div>

    <p>We value your feedback. If you'd like to share your reasons for leaving or have suggestions for improvement, please contact our support team.</p>

    <p>Should you wish to rejoin NMGA in the future, you're always welcome to create a new account.</p>
`);
