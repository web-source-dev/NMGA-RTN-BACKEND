const baseTemplate = require('./baseTemplate');

/**
 * Email template for distributor posting deadline reminders
 * @param {string} distributorName - Name of the distributor
 * @param {Array} deals - Array of deals that need to be posted (empty for monthly reminders)
 * @param {string} reminderType - Type of reminder (5_days, 3_days, 1_day)
 * @param {string} month - Month name for the deal
 * @param {number} year - Year for the deal
 * @param {string} deadline - Deadline date
 * @param {string} commitmentStart - Commitment window start date
 * @param {string} commitmentEnd - Commitment window end date
 * @returns {string} - HTML email content
 */
const postingDeadlineReminder = (distributorName, deals, reminderType, month, year, deadline, commitmentStart, commitmentEnd) => {
  const daysText = {
    '5_days': '5 days',
    '3_days': '3 days', 
    '1_day': '1 day'
  };

  const urgencyLevel = {
    '5_days': 'info',
    '3_days': 'warning',
    '1_day': 'danger'
  };

  const urgencyClass = urgencyLevel[reminderType] || 'info';
  const days = daysText[reminderType] || reminderType;

  // Format dates for display
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const content = `
    <h1>Monthly Deal Posting Deadline Reminder</h1>
    
    <div class="alert-${urgencyClass}">
      <strong>⏰ Important:</strong> You have ${days} remaining to post your deals for ${month} ${year}!
    </div>
    
    <p>Dear ${distributorName},</p>
    
    <p>This is a friendly reminder that you have <strong>${days}</strong> remaining to post your deals for <strong>${month} ${year}</strong>. The posting deadline is approaching, and members will be able to make commitments starting on the commitment start date.</p>
    
    <div class="card">
      <h3 class="card-header">${month} ${year} Deal Schedule</h3>
      <p><strong>📅 Posting Deadline:</strong> ${formatDate(deadline)}</p>
      <p><strong>📅 Commitment Window:</strong> ${formatDate(commitmentStart)} - ${formatDate(commitmentEnd)}</p>
      <p><strong>📅 Deal Period:</strong> ${formatDate(commitmentStart)} - End of ${month} ${year}</p>
    </div>
    
    <div class="alert-info">
      <strong>📋 Action Required:</strong>
      <ul>
        <li>Create and post your deals for ${month} ${year}</li>
        <li>Review and finalize your deal details</li>
        <li>Ensure all pricing and discount tiers are correct</li>
        <li>Upload any necessary product images</li>
        <li>Set your deals to "Active" status before the deadline</li>
      </ul>
    </div>
    
    <div class="alert-warning">
      <strong>⚠️ Important:</strong> All deals must be posted and active before the commitment window opens. Members will not be able to make commitments for deals that are not posted in time.
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/distributor" class="button">
        Go to Dashboard
      </a>
    </div>
    
    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The NMGA Team</p>
  `;

  return baseTemplate(content);
};

/**
 * Email template for distributor deal approval reminders
 * @param {string} distributorName - Name of the distributor
 * @param {Array} deals - Array of deals that need approval
 * @returns {string} - HTML email content
 */
const dealApprovalReminder = (distributorName, deals) => {
  const dealsList = deals.map(deal => {
    const commitmentCount = deal.commitments ? deal.commitments.length : 0;
    const totalQuantity = deal.commitments ? deal.commitments.reduce((sum, commitment) => {
      return sum + (commitment.sizeCommitments ? commitment.sizeCommitments.reduce((sizeSum, sizeCommitment) => 
        sizeSum + sizeCommitment.quantity, 0) : 0);
    }, 0) : 0;
    
    return `
      <div class="card">
        <h4 class="card-header">${deal.name}</h4>
        <p><strong>Category:</strong> ${deal.category || 'Not specified'}</p>
        <p><strong>Commitment Window:</strong> ${new Date(deal.commitmentStartAt).toLocaleDateString()} - ${new Date(deal.commitmentEndsAt).toLocaleDateString()}</p>
        <p><strong>Total Commitments:</strong> ${commitmentCount} members</p>
        <p><strong>Total Quantity:</strong> ${totalQuantity} units</p>
        <p><strong>Status:</strong> <span style="color: #856404; font-weight: bold;">Pending Approval</span></p>
      </div>
    `;
  }).join('');

  const content = `
    <h1>Deal Approval Reminder</h1>
    
    <div class="alert-warning">
      <strong>📋 Action Required:</strong> The commitment window has closed and you have deals waiting for your approval!
    </div>
    
    <p>Dear ${distributorName},</p>
    
    <p>The commitment window for your deals has closed, and members have made their commitments. It's now time to review and approve these commitments to finalize the deals.</p>
    
    <h2>Deals Awaiting Approval</h2>
    <p>The following deals have received commitments and are waiting for your approval:</p>
    
    ${dealsList}
    
    <div class="alert-info">
      <strong>📋 Next Steps:</strong>
      <ul>
        <li>Review all commitments for each deal</li>
        <li>Approve or decline individual commitments as needed</li>
        <li>Modify quantities or pricing if necessary</li>
        <li>Activate approved deals to make them available for purchase</li>
      </ul>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/distributor" class="button">
        Review Commitments
      </a>
    </div>
    
    <p><strong>Important:</strong> Prompt approval helps ensure smooth order processing and member satisfaction.</p>
    
    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The NMGA Team</p>
  `;

  return baseTemplate(content);
};

module.exports = {
  postingDeadlineReminder,
  dealApprovalReminder
};
