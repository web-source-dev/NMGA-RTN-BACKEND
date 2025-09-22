const baseTemplate = require('./baseTemplate');

const generateDailyCommitmentStatusSummary = (memberName, summaryData) => {
  const { approvedCommitments, declinedCommitments, totalApprovedValue, totalDeclinedValue } = summaryData;
  
  const approvedCount = approvedCommitments.length;
  const declinedCount = declinedCommitments.length;
  
  let approvedSection = '';
  let declinedSection = '';
  
  // Generate approved commitments section
  if (approvedCount > 0) {
    approvedSection = `
      <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #155724; margin: 0 0 15px 0; font-size: 18px;">
          ✅ Approved Commitments (${approvedCount})
        </h3>
        <div style="background-color: #ffffff; border-radius: 6px; padding: 15px;">
    `;
    
    approvedCommitments.forEach((commitment, index) => {
      const sizeDetails = commitment.commitmentDetails.sizeCommitments && commitment.commitmentDetails.sizeCommitments.length > 0
        ? commitment.commitmentDetails.sizeCommitments.map(sc => 
            `${sc.size}: ${sc.quantity} × $${sc.pricePerUnit.toFixed(2)}`
          ).join(', ')
        : `${commitment.commitmentDetails.quantity || 0} units`;
      
      approvedSection += `
        <div style="border-bottom: 1px solid #e9ecef; padding: 10px 0; ${index === approvedCommitments.length - 1 ? 'border-bottom: none;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="color: #155724; margin: 0; font-size: 16px;">${commitment.dealName}</h4>
            <span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
              APPROVED
            </span>
          </div>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Distributor:</strong> ${commitment.distributorName}
          </p>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Size Details:</strong> ${sizeDetails}
          </p>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Total Value:</strong> $${commitment.commitmentDetails.totalPrice.toFixed(2)}
          </p>
          ${commitment.distributorResponse ? `
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
              <strong>Distributor Note:</strong> ${commitment.distributorResponse}
            </p>
          ` : ''}
        </div>
      `;
    });
    
    approvedSection += `
        </div>
        <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #155724;">
            Total Approved Value: $${totalApprovedValue.toFixed(2)}
          </p>
        </div>
      </div>
    `;
  }
  
  // Generate declined commitments section
  if (declinedCount > 0) {
    declinedSection = `
      <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #721c24; margin: 0 0 15px 0; font-size: 18px;">
          ❌ Declined Commitments (${declinedCount})
        </h3>
        <div style="background-color: #ffffff; border-radius: 6px; padding: 15px;">
    `;
    
    declinedCommitments.forEach((commitment, index) => {
      const sizeDetails = commitment.commitmentDetails.sizeCommitments && commitment.commitmentDetails.sizeCommitments.length > 0
        ? commitment.commitmentDetails.sizeCommitments.map(sc => 
            `${sc.size}: ${sc.quantity} × $${sc.pricePerUnit.toFixed(2)}`
          ).join(', ')
        : `${commitment.commitmentDetails.quantity || 0} units`;
      
      declinedSection += `
        <div style="border-bottom: 1px solid #e9ecef; padding: 10px 0; ${index === declinedCommitments.length - 1 ? 'border-bottom: none;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h4 style="color: #721c24; margin: 0; font-size: 16px;">${commitment.dealName}</h4>
            <span style="background-color: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
              DECLINED
            </span>
          </div>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Distributor:</strong> ${commitment.distributorName}
          </p>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Size Details:</strong> ${sizeDetails}
          </p>
          <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
            <strong>Total Value:</strong> $${commitment.commitmentDetails.totalPrice.toFixed(2)}
          </p>
          ${commitment.distributorResponse ? `
            <p style="margin: 5px 0; color: #6c757d; font-size: 14px;">
              <strong>Distributor Note:</strong> ${commitment.distributorResponse}
            </p>
          ` : ''}
        </div>
      `;
    });
    
    declinedSection += `
        </div>
        <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #721c24;">
            Total Declined Value: $${totalDeclinedValue.toFixed(2)}
          </p>
        </div>
      </div>
    `;
  }
  
  const summaryStats = `
    <div style="background-color: #e2e3e5; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 18px;">📊 Daily Summary</h3>
      <div style="display: flex; justify-content: space-around; flex-wrap: wrap;">
        <div style="text-align: center; margin: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #28a745;">${approvedCount}</div>
          <div style="color: #6c757d; font-size: 14px;">Approved</div>
        </div>
        <div style="text-align: center; margin: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${declinedCount}</div>
          <div style="color: #6c757d; font-size: 14px;">Declined</div>
        </div>
        <div style="text-align: center; margin: 10px;">
          <div style="font-size: 24px; font-weight: bold; color: #007bff;">$${(totalApprovedValue + totalDeclinedValue).toFixed(2)}</div>
          <div style="color: #6c757d; font-size: 14px;">Total Value</div>
        </div>
      </div>
    </div>
  `;
  
  const emailContent = `
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Daily Commitment Status Update</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
          Your commitment status updates for today
        </p>
      </div>
      
      <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <p style="color: #495057; font-size: 16px; margin: 0 0 20px 0;">
          Hello <strong>${memberName}</strong>,
        </p>
        
        <p style="color: #6c757d; font-size: 14px; margin: 0 0 25px 0;">
          Here's a summary of your commitment status updates for today. We've processed ${approvedCount + declinedCount} commitment${(approvedCount + declinedCount) !== 1 ? 's' : ''} across different deals.
        </p>
        
        ${summaryStats}
        
        ${approvedSection}
        
        ${declinedSection}
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #495057; font-size: 14px;">
            <strong>💡 Note:</strong> You can view all your commitments and their current status by logging into your NMGA account. 
            If you have any questions about these updates, please contact the respective distributors or our support team.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; font-size: 12px; margin: 0;">
            This is an automated message from the New Mexico Grocers Association.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    </div>
  `;
  
  return baseTemplate.generateEmailTemplate(
    'Daily Commitment Status Update',
    emailContent
  );
};

module.exports = {
  generateDailyCommitmentStatusSummary
};
