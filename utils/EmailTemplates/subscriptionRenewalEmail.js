const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (name, renewalDetails) => baseTemplate(`
    <h2>Subscription Renewal Notice</h2>
    <p>Dear ${name},</p>

    <div class="card">
        <h3 class="card-header">Renewal Information:</h3>
        <ul>
            <li>Renewal Date: ${renewalDetails.renewalDate}</li>
            <li>Subscription Plan: ${renewalDetails.plan}</li>
            <li>Amount: $${renewalDetails.amount}</li>
        </ul>
    </div>

    <div class="alert-box alert-info">
        <p><strong>Your NMGA membership benefits include:</strong></p>
        <ul>
            <li>Access to exclusive group deals</li>
            <li>Bulk purchasing opportunities</li>
            <li>Network with other members</li>
            <li>Premium support services</li>
        </ul>
    </div>

    <div class="alert-box alert-warning">
        <p style="margin: 0;">
            <strong>Note:</strong> To ensure uninterrupted service, please ensure your payment method is up to date.
        </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/account/subscription" class="button">Manage Subscription</a>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        Thank you for being a valued member of NMGA!
    </p>
`);
