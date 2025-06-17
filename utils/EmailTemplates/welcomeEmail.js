const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name) => baseTemplate(`
    <h2>Welcome to NMGA!</h2>
    <p>Dear ${name},</p>

    <p>We're thrilled to have you join our community of forward-thinking businesses!</p>

    <div class="alert-box alert-info">
        <h3>Getting Started Guide:</h3>
        <ol>
            <li>Complete your profile information</li>
            <li>Set your preferences for deals</li>
            <li>Connect with other members</li>
            <li>Browse active deals</li>
        </ol>
    </div>

    <div class="card">
        <h3 class="card-header">Key Features Available to You:</h3>
        <ul>
            <li>Access to exclusive group deals</li>
            <li>Bulk purchasing opportunities</li>
            <li>Network with industry peers</li>
            <li>Real-time deal notifications</li>
            <li>Dedicated support team</li>
        </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/login" class="button">Start Exploring</a>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        Need help? Our support team is available 24/7 to assist you.
    </p>
`);
