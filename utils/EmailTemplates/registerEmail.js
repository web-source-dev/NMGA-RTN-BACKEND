const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Welcome to NMGA!</h2>
    <p>Dear ${name},</p>

    <p>Thank you for joining our community. Your account has been successfully created.</p>

    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
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
        <a href="${FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
    </div>

    <p>Need help? Our support team is always here to assist you.</p>
`);
