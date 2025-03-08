const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

// Helper function to safely format numbers
const safeNumberFormat = (number) => {
    return typeof number === 'number' ? number.toLocaleString() : '0';
};

const DailyCommitmentSummaryTemplate = {
    user: (userName, commitments, totalAmount, totalQuantity) => baseTemplate(`
        <h2>Your Daily Commitment Summary</h2>
        <p>Dear ${userName || 'User'},</p>
        <p>Here's a summary of all your commitments made today:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Summary</h3>
            <ul style="list-style: none; padding: 0;">
                <li>Total Commitments: ${(commitments || []).length}</li>
                <li>Total Quantity: ${safeNumberFormat(totalQuantity)} units</li>
                <li>Total Amount: $${safeNumberFormat(totalAmount)}</li>
            </ul>
        </div>

        <h3>Commitment Details:</h3>
        ${(commitments || []).map(commitment => `
            <div style="border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 8px;">
                <h4 style="margin-top: 0;">${commitment.dealName || 'Unknown Deal'}</h4>
                <ul style="list-style: none; padding: 0;">
                    <li>Quantity: ${safeNumberFormat(commitment.quantity)} units</li>
                    <li>Price per unit: $${safeNumberFormat(commitment.discountPrice)}</li>
                    <li>Total Price: $${safeNumberFormat(commitment.totalPrice)}</li>
                    <li>You Save: $${safeNumberFormat((commitment.originalCost - commitment.discountPrice) * commitment.quantity)}</li>
                </ul>
            </div>
        `).join('')}

        <div style="text-align: center; margin-top: 30px;">
            <a href="${FRONTEND_URL}/dashboard" class="button">View All Commitments</a>
        </div>
    `),

    distributor: (distributorName, commitments, totalAmount, totalQuantity) => baseTemplate(`
        <h2>Daily Commitment Summary Report</h2>
        <p>Hello ${distributorName || 'Distributor'},</p>
        <p>Here's a summary of all commitments received today for your deals:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Summary</h3>
            <ul style="list-style: none; padding: 0;">
                <li>Total Commitments: ${(commitments || []).length}</li>
                <li>Total Quantity: ${safeNumberFormat(totalQuantity)} units</li>
                <li>Total Revenue: $${safeNumberFormat(totalAmount)}</li>
            </ul>
        </div>

        <h3>Commitment Details:</h3>
        ${(commitments || []).map(commitment => `
            <div style="border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 8px;">
                <h4 style="margin-top: 0;">${commitment.dealName || 'Unknown Deal'}</h4>
                <ul style="list-style: none; padding: 0;">
                    <li>Member: ${commitment.userName || 'Unknown Member'}</li>
                    <li>Quantity: ${safeNumberFormat(commitment.quantity)} units</li>
                    <li>Total Price: $${safeNumberFormat(commitment.totalPrice)}</li>
                </ul>
            </div>
        `).join('')}

        <div style="text-align: center; margin-top: 30px;">
            <a href="${FRONTEND_URL}/dashboard" class="button">View All Commitments</a>
        </div>
    `),

    admin: (summaries) => baseTemplate(`
        <h2>Daily Platform Commitment Summary</h2>
        <p>Here's a summary of all commitments made on the platform today:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Platform Summary</h3>
            <ul style="list-style: none; padding: 0;">
                <li>Total Distributors: ${(summaries || []).length}</li>
                <li>Total Commitments: ${safeNumberFormat((summaries || []).reduce((acc, curr) => acc + (curr.totalCommitments || 0), 0))}</li>
                <li>Total Revenue: $${safeNumberFormat((summaries || []).reduce((acc, curr) => acc + (curr.totalAmount || 0), 0))}</li>
            </ul>
        </div>

        <h3>Distributor-wise Summary:</h3>
        ${(summaries || []).map(summary => `
            <div style="border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 8px;">
                <h4 style="margin-top: 0;">${summary.distributorName || 'Unknown Distributor'}</h4>
                <ul style="list-style: none; padding: 0;">
                    <li>Total Commitments: ${safeNumberFormat(summary.totalCommitments)}</li>
                    <li>Total Quantity: ${safeNumberFormat(summary.totalQuantity)} units</li>
                    <li>Total Revenue: $${safeNumberFormat(summary.totalAmount)}</li>
                    <li>Unique Members: ${safeNumberFormat(summary.uniqueMembers)}</li>
                </ul>
            </div>
        `).join('')}

        <div style="text-align: center; margin-top: 30px;">
            <a href="${FRONTEND_URL}/admin/dashboard" class="button">View Dashboard</a>
        </div>
    `)
};

module.exports = DailyCommitmentSummaryTemplate; 