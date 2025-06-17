const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Welcome to NMGA!</h2>
    <p>Dear ${name},</p>

    <p>Thank you for joining our community. Your account has been successfully created.</p>

    <div class="alert-box alert-info">
        <h3>Getting Started:</h3>
        <ol>
            <li>Complete your profile</li>
            <li>Browse available deals</li>
            <li>Make your first commitment</li>
            <li>Connect with other members</li>
        </ol>
    </div>

    <p>Ready to explore?</p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/dashboard/co-op-member" class="button">Go to Dashboard</a>
    </div>

    <p>Need help? Our support team is always here to assist you.</p>
`);
