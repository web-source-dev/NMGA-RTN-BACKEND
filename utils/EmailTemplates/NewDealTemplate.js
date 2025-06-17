const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (dealName, dealMakerName, recipientName, dealId) => baseTemplate(`
    <h2>New Deal Announcement</h2>
    <p>Dear ${recipientName},</p>
    
    <p>We are excited to announce a new deal opportunity!</p>
    
    <div class="card">
        <h3 class="card-header">${dealName}</h3>
        <p>Created by: ${dealMakerName}</p>
    </div>

    <div class="alert-box alert-info">
        <p><strong>This new deal offers:</strong></p>
        <ul>
            <li>Save on bulk purchases</li>
            <li>Access exclusive pricing</li>
            <li>Collaborate with other members</li>
        </ul>
    </div>

    <p>Don't miss out on this opportunity! Review the deal details and make your commitment today.</p>

    <div style="text-align: center; margin-top: 20px;">
        <a href="${FRONTEND_URL}/deals-catlog/deals/${dealId}" class="button">View Deal Details</a>
    </div>

    <p style="font-size: 0.9em; margin-top: 20px;">
        Note: Deals are subject to availability and may close once the maximum quantity is reached.
    </p>
`);
