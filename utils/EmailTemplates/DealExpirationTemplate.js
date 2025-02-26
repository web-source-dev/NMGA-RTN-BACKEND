const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

module.exports = (userName, dealName, expirationDate, timeRemaining) => baseTemplate(`
    <h2>${timeRemaining === 'expired' ? 'Deal Has Expired' : 'Deal Ending Soon!'}</h2>
    <p>Dear ${userName},</p>

    ${timeRemaining === 'expired' ? `
      <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: #721c24; margin: 0;">
          <strong>Notice:</strong> The deal "${dealName}" has expired and is no longer available.
        </p>
      </div>
    ` : `
      <div style="background-color: ${
        timeRemaining === '1 hour' ? '#f8d7da' :
        timeRemaining === '1 day' ? '#fff3cd' :
        '#d4edda'
      }; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="color: ${
          timeRemaining === '1 hour' ? '#721c24' :
          timeRemaining === '1 day' ? '#856404' :
          '#155724'
        }; margin: 0;">
          <strong>Time-Sensitive Notice:</strong> The deal "${dealName}" is ending in ${timeRemaining}!
        </p>
      </div>
    `}

    <p>Deal Details:</p>
    <ul>
        <li>Deal Name: ${dealName}</li>
        ${timeRemaining !== 'expired' ? `
          <li>Expires on: ${new Date(expirationDate).toLocaleDateString()}</li>
          <li>Time Remaining: ${timeRemaining}</li>
        ` : `
          <li>Expired on: ${new Date(expirationDate).toLocaleDateString()}</li>
        `}
    </ul>

    ${timeRemaining !== 'expired' ? `
      <p>Don't miss out on this opportunity! Review the deal and make your commitment before it expires.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/deals-catalog/deals" class="button">View Deal</a>
      </div>

      <p style="font-size: 0.9em; color: #666;">
        Note: Once the deal expires, it will no longer be available for new commitments.
      </p>
    ` : `
      <p>Thank you for your interest in this deal. Check out our other active deals:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${FRONTEND_URL}/deals-catalog/deals" class="button">Browse Active Deals</a>
      </div>
    `}
`); 