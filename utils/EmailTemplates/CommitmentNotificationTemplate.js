const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

const CommitmentNotificationTemplate = {
  user: (userName, dealName, quantity, totalPrice, sizeCommitments = null) => {
    let quantityHtml = '';
    
    if (sizeCommitments && sizeCommitments.length > 0) {
      // For size-based commitments
      quantityHtml = `
        <li>
          <strong>Size Details:</strong>
          <ul>
            ${sizeCommitments.map(item => `
              <li>${item.size}: ${item.quantity} × $${item.pricePerUnit.toFixed(2)} = $${item.totalPrice.toFixed(2)}</li>
            `).join('')}
          </ul>
        </li>
        <li>Total Quantity: ${sizeCommitments.reduce((sum, item) => sum + item.quantity, 0)}</li>
      `;
    } else {
      // For regular commitments
      quantityHtml = `<li>Quantity: ${quantity}</li>`;
    }
    
    return baseTemplate(`
      <h2>Commitment Confirmation</h2>
      <p>Dear ${userName},</p>
      <p>Your commitment to the deal <strong>${dealName}</strong> has been successfully recorded.</p>
      
      <div class="card">
        <h3 class="card-header">Commitment Details:</h3>
        <ul>
          <li>Deal: ${dealName}</li>
          ${quantityHtml}
          <li>Total Price: $${totalPrice.toLocaleString()}</li>
          <li>Status: Pending</li>
        </ul>
      </div>

      <div class="alert-box alert-info">
        <p><strong>What happens next?</strong></p>
        <ul>
          <li>The distributor will review your commitment</li>
          <li>You'll receive an email when the status changes</li>
          <li>You can track your commitment status in your dashboard</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${FRONTEND_URL}/dashboard/co-op-member/commitments" class="button">View Your Commitments</a>
      </div>
    `);
  },

  distributor: (userName, dealName, quantity, totalPrice, sizeCommitments = null) => {
    let quantityHtml = '';
    
    if (sizeCommitments && sizeCommitments.length > 0) {
      // For size-based commitments
      quantityHtml = `
        <li>
          <strong>Size Details:</strong>
          <ul>
            ${sizeCommitments.map(item => `
              <li>${item.size}: ${item.quantity} × $${item.pricePerUnit.toFixed(2)} = $${item.totalPrice.toFixed(2)}</li>
            `).join('')}
          </ul>
        </li>
        <li>Total Quantity: ${sizeCommitments.reduce((sum, item) => sum + item.quantity, 0)}</li>
      `;
    } else {
      // For regular commitments
      quantityHtml = `<li>Quantity: ${quantity}</li>`;
    }
    
    return baseTemplate(`
      <h2>New Commitment Received</h2>
      <p>Hello,</p>
      <p>You have received a new commitment for your deal <strong>${dealName}</strong>.</p>

      <div class="card">
        <h3 class="card-header">Commitment Details:</h3>
        <ul>
          <li>Member: ${userName}</li>
          <li>Deal: ${dealName}</li>
          ${quantityHtml}
          <li>Total Price: $${totalPrice.toLocaleString()}</li>
          <li>Status: Pending Review</li>
        </ul>
      </div>

      <div class="alert-box alert-info">
        <p><strong>Required Actions:</strong></p>
        <ul>
          <li>Review the commitment details</li>
          <li>Approve or modify the commitment</li>
          <li>Provide any necessary feedback</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${FRONTEND_URL}/dashboard/co-op-member/commitments" class="button">Review Commitment</a>
      </div>
    `);
  },
  
  statusUpdate: (userName, dealName, status, quantity, totalPrice, sizeCommitments = null) => {
    let quantityHtml = '';
    
    if (sizeCommitments && sizeCommitments.length > 0) {
      // For size-based commitments
      quantityHtml = `
        <li>
          <strong>Size Details:</strong>
          <ul>
            ${sizeCommitments.map(item => `
              <li>${item.size}: ${item.quantity} × $${item.pricePerUnit.toFixed(2)} = $${item.totalPrice.toFixed(2)}</li>
            `).join('')}
          </ul>
        </li>
        <li>Total Quantity: ${sizeCommitments.reduce((sum, item) => sum + item.quantity, 0)}</li>
      `;
    } else {
      // For regular commitments
      quantityHtml = `<li>Quantity: ${quantity}</li>`;
    }

    const statusClassName = status === 'approved' ? 'alert-success' : 'alert-warning';
    
    return baseTemplate(`
      <h2>Commitment Update</h2>
      <p>Dear ${userName},</p>
      <p>Your commitment for the deal <strong>${dealName}</strong> has been updated.</p>
      
      <div class="card">
        <h3 class="card-header">Commitment Details:</h3>
        <ul>
          <li>Deal: ${dealName}</li>
          ${quantityHtml}
          <li>Total Price: $${totalPrice.toLocaleString()}</li>
          <li>Status: <strong>${status.charAt(0).toUpperCase() + status.slice(1)}</strong> by the distributor</li>
        </ul>
      </div>

      <div class="alert-box ${statusClassName}">
        <p>${status === 'approved' 
          ? 'Your commitment has been approved by the distributor. You will be contacted with further instructions regarding payment and delivery.' 
          : 'Unfortunately, your commitment has been declined by the distributor. Please check your dashboard for more information or contact the distributor directly if you have any questions.'}</p>
      </div>

      <div style="text-align: center;">
        <a href="${FRONTEND_URL}/dashboard/co-op-member/commitments" class="button">View Your Commitments</a>
      </div>
    `);
  }
};

module.exports = CommitmentNotificationTemplate; 