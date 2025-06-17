const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

const promotionEmail = (name, promotionDetails) => baseTemplate(`
    <h2>Exclusive Promotion!</h2>
    <p>Dear ${name},</p>

    <div class="alert-box alert-primary">
        <h3>Special Offer</h3>
        <p>${promotionDetails}</p>
    </div>

    <p>This limited-time offer is exclusively available to valued members like you. Take advantage of this opportunity today!</p>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/promotions" class="button">View Promotion Details</a>
    </div>

    <p style="font-size: 0.9em; color: #666;">
        Offer valid for a limited time. Terms and conditions apply.
    </p>
`);

module.exports = promotionEmail;
