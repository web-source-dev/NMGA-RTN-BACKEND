const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

const CommitmentNotificationTemplate = {
  user: (userName, dealName, quantity, totalPrice) => baseTemplate(`
    <h2>Commitment Confirmation</h2>
    <p>Dear ${userName},</p>
    <p>Your commitment to the deal <strong>${dealName}</strong> has been successfully recorded.</p>
    
    <h3>Commitment Details:</h3>
    <ul>
      <li>Deal: ${dealName}</li>
      <li>Quantity: ${quantity}</li>
      <li>Total Price: $${totalPrice.toLocaleString()}</li>
      <li>Status: Pending</li>
    </ul>

    <p>What happens next?</p>
    <ul>
      <li>The distributor will review your commitment</li>
      <li>You'll receive an email when the status changes</li>
      <li>You can track your commitment status in your dashboard</li>
    </ul>

    <a href="${FRONTEND_URL}/dashboard" class="button">View Your Commitments</a>
  `),

  distributor: (userName, dealName, quantity, totalPrice) => baseTemplate(`
    <h2>New Commitment Received</h2>
    <p>Hello,</p>
    <p>You have received a new commitment for your deal <strong>${dealName}</strong>.</p>

    <h3>Commitment Details:</h3>
    <ul>
      <li>Member: ${userName}</li>
      <li>Deal: ${dealName}</li>
      <li>Quantity: ${quantity}</li>
      <li>Total Price: $${totalPrice.toLocaleString()}</li>
      <li>Status: Pending Review</li>
    </ul>

    <p>Required Actions:</p>
    <ul>
      <li>Review the commitment details</li>
      <li>Approve or modify the commitment</li>
      <li>Provide any necessary feedback</li>
    </ul>

    <a href="${FRONTEND_URL}/dashboard" class="button">Review Commitment</a>
  `)
};

module.exports = CommitmentNotificationTemplate; 