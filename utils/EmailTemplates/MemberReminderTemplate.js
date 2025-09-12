const baseTemplate = require('./baseTemplate');

/**
 * Email template for member commitment window opening reminder
 * @param {string} memberName - Name of the member
 * @param {Date} commitmentStartDate - When commitment window opens
 * @param {Date} commitmentEndDate - When commitment window closes
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {string} - HTML email content
 */
const commitmentWindowOpeningReminder = (memberName, commitmentStartDate, commitmentEndDate, month, year) => {
  const startDate = new Date(commitmentStartDate);
  const endDate = new Date(commitmentEndDate);
  
  const content = `
    <h1>Commitment Window Opening Tomorrow - ${month} ${year}</h1>
    
    <div class="alert-info">
      <strong>📅 Important:</strong> The commitment window for ${month} ${year} deals will open tomorrow!
    </div>
    
    <p>Dear ${memberName},</p>
    
    <p>This is a friendly reminder that the commitment window for <strong>${month} ${year}</strong> deals will open tomorrow. You'll have the opportunity to make commitments for exclusive member pricing on various products.</p>
    
    <div class="card">
      <h3 class="card-header">${month} ${year} Commitment Window Schedule</h3>
      <p><strong>📅 Opens:</strong> ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${startDate.toLocaleTimeString()}</p>
      <p><strong>📅 Closes:</strong> ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${endDate.toLocaleTimeString()}</p>
      <p><strong>⏰ Duration:</strong> ${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} days</p>
    </div>
    
    <div class="alert-success">
      <strong>✅ What to Expect:</strong>
      <ul>
        <li>Access to exclusive member pricing for ${month} ${year}</li>
        <li>Bulk discount opportunities</li>
        <li>Limited-time offers</li>
        <li>Priority access to popular items</li>
      </ul>
    </div>
    
    <div class="alert-warning">
      <strong>⏰ Important:</strong> The commitment window has a limited duration. Make sure to review and commit to deals before the window closes!
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/deals-catlog" class="button">
        View Available Deals
      </a>
    </div>
    
    <p>If you have any questions about the commitment process or need assistance, please don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The NMGA Team</p>
  `;

  return baseTemplate(content);
};

/**
 * Email template for member commitment window closing reminder
 * @param {string} memberName - Name of the member
 * @param {Date} commitmentEndDate - When commitment window closes
 * @param {string} timeRemaining - Time remaining (e.g., "5 days", "3 days", "1 day", "1 hour")
 * @param {boolean} hasCommitments - Whether the member has made any commitments
 * @param {string} month - Month name
 * @param {number} year - Year
 * @returns {string} - HTML email content
 */
const commitmentWindowClosingReminder = (memberName, commitmentEndDate, timeRemaining, hasCommitments, month, year) => {
  const endDate = new Date(commitmentEndDate);
  
  const urgencyLevel = {
    '5 days': 'info',
    '3 days': 'warning', 
    '1 day': 'warning',
    '1 hour': 'danger'
  };
  
  const urgencyClass = urgencyLevel[timeRemaining] || 'info';
  
  const commitmentStatus = hasCommitments ? 
    '<span style="color: #155724; font-weight: bold;">✅ You have made commitments</span>' :
    '<span style="color: #856404; font-weight: bold;">⚠️ No commitments yet</span>';
  
  const content = `
    <h1>Commitment Window Closing Soon - ${month} ${year}</h1>
    
    <div class="alert-${urgencyClass}">
      <strong>⏰ Important:</strong> The commitment window for ${month} ${year} will close in ${timeRemaining}!
    </div>
    
    <p>Dear ${memberName},</p>
    
    <p>This is a reminder that the commitment window for <strong>${month} ${year}</strong> deals will close in <strong>${timeRemaining}</strong>. After the window closes, you won't be able to make new commitments until the next month's window opens.</p>
    
    <div class="card">
      <h3 class="card-header">${month} ${year} Commitment Window Status</h3>
      <p><strong>📅 Closes:</strong> ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${endDate.toLocaleTimeString()}</p>
      <p><strong>⏰ Time Remaining:</strong> ${timeRemaining}</p>
      <p><strong>📋 Your Status:</strong> ${commitmentStatus}</p>
    </div>
    
    ${!hasCommitments ? `
    <div class="alert-warning">
      <strong>⚠️ Action Required:</strong>
      <ul>
        <li>You haven't made any commitments for ${month} ${year} yet</li>
        <li>Review available deals and pricing</li>
        <li>Make your commitments before the window closes</li>
        <li>Don't miss out on exclusive member pricing</li>
      </ul>
    </div>
    ` : `
    <div class="alert-success">
      <strong>✅ Great Job!</strong>
      <ul>
        <li>You've already made commitments for ${month} ${year}</li>
        <li>Review your commitments if needed</li>
        <li>Make additional commitments if desired</li>
        <li>Your orders will be processed after the window closes</li>
      </ul>
    </div>
    `}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL}/dashboard/co-op-member" class="button">
        ${hasCommitments ? 'Review My Commitments' : 'Make Commitments Now'}
      </a>
    </div>
    
    <p><strong>Note:</strong> After the commitment window closes, distributors will review and approve commitments before finalizing orders.</p>
    
    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
    
    <p>Best regards,<br>
    The NMGA Team</p>
  `;

  return baseTemplate(content);
};

module.exports = {
  commitmentWindowOpeningReminder,
  commitmentWindowClosingReminder
};
