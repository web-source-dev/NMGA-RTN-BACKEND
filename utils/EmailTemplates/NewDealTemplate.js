const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (dealName, dealMakerName, recipientName) => baseTemplate(`
    <h2>New Deal Announcement</h2>
    <p>Dear ${recipientName},</p>
    
    <p>We are excited to announce a new deal opportunity!</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3>${dealName}</h3>
        <p>Created by: ${dealMakerName}</p>
    </div>

    <p>This new deal might be a perfect opportunity for you to:</p>
    <ul>
        <li>Save on bulk purchases</li>
        <li>Access exclusive pricing</li>
        <li>Collaborate with other members</li>
    </ul>

    <p>Don't miss out on this opportunity! Review the deal details and make your commitment today.</p>

    <a href="${FRONTEND_URL}/deals" class="button">View Deal Details</a>

    <p style="font-size: 0.9em; margin-top: 20px;">
        Note: Deals are subject to availability and may close once the maximum quantity is reached.
    </p>
`);
