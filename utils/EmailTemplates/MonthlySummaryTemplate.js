const baseTemplate = require('./baseTemplate');

// Helper function to safely format numbers
const safeNumberFormat = (number) => {
    return typeof number === 'number' ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
};

const formatCurrency = (amount) => {
    return typeof amount === 'number' ? `$${safeNumberFormat(amount)}` : '$0.00';
};

const MonthlySummaryTemplate = (summary) => {
    const { reportPeriod, users, deals, commitments, activity } = summary;

    return baseTemplate(`
        <h1>📊 Monthly Summary Report</h1>
        <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            <strong>Report Period:</strong> ${reportPeriod.monthName}<br>
            <strong>Generated:</strong> ${new Date(summary.generatedAt).toLocaleString('en-US', { 
                dateStyle: 'long', 
                timeStyle: 'short' 
            })}
        </p>
        <p style="font-size: 14px; color: #999; margin-bottom: 30px;">
            <em>A detailed PDF report has been attached to this email.</em>
        </p>

        <div class="alert-box alert-primary">
            <h2 style="margin-top: 0;">📈 Executive Summary</h2>
            <ul style="font-size: 16px;">
                <li><strong>Total Deals:</strong> ${deals.total.toLocaleString()}</li>
                <li><strong>Total Commitments:</strong> ${commitments.total.toLocaleString()}</li>
                <li><strong>Total Revenue:</strong> ${formatCurrency(commitments.totalRevenue)}</li>
            </ul>
        </div>

        ${users.byRole && users.byRole.length > 0 ? `
            <h2>👥 Users by Role (Previous Month)</h2>
            <div class="card">
                <ul>
                    ${users.byRole.map(role => `
                        <li><strong>${role._id || 'Unknown'}:</strong> ${role.count.toLocaleString()}</li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        <h2>💼 Deal Statistics (Previous Month)</h2>
        <div class="card">
            <ul>
                <li><strong>Total Deals:</strong> ${deals.total.toLocaleString()}</li>
            </ul>
            
            ${deals.byCategory && deals.byCategory.length > 0 ? `
                <h3>Deals by Category:</h3>
                <ul>
                    ${deals.byCategory.map(cat => `
                        <li><strong>${cat._id || 'Uncategorized'}:</strong> ${cat.count.toLocaleString()}</li>
                    `).join('')}
                </ul>
            ` : ''}
        </div>

        <h2>📝 Commitment Statistics (Previous Month)</h2>
        <div class="card">
            <ul>
                <li><strong>Total Commitments:</strong> ${commitments.total.toLocaleString()}</li>
                <li><strong>Total Revenue:</strong> ${formatCurrency(commitments.totalRevenue)}</li>
                <li><strong>Total Quantity Committed:</strong> ${commitments.totalQuantity.toLocaleString()} units</li>
            </ul>
            
            ${commitments.byStatus && commitments.byStatus.length > 0 ? `
                <h3>Commitments by Status:</h3>
                <ul>
                    ${commitments.byStatus.map(status => `
                        <li><strong>${status._id || 'Unknown'}:</strong> ${status.count.toLocaleString()} 
                            ${status.totalRevenue ? `(${formatCurrency(status.totalRevenue)})` : ''}</li>
                    `).join('')}
                </ul>
            ` : ''}
        </div>

        ${commitments.topDeals && commitments.topDeals.length > 0 ? `
            <h2>🏆 Top 10 Deals by Commitments</h2>
            <div class="card">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Deal Name</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Distributor</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Commitments</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Revenue</th>
                            <th style="padding: 10px; text-align: center; border-bottom: 1px solid #dee2e6;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${commitments.topDeals.map((deal, index) => `
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 8px;">${deal.dealName}</td>
                                <td style="padding: 8px;">${deal.distributorName}</td>
                                <td style="padding: 8px; text-align: right;">${deal.commitments.toLocaleString()}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(deal.revenue)}</td>
                                <td style="padding: 8px; text-align: center;">
                                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;
                                        ${deal.status === 'approved' ? 'background-color: #d4edda; color: #155724;' : ''}
                                        ${deal.status === 'declined' ? 'background-color: #f8d7da; color: #721c24;' : ''}
                                        ${deal.status === 'cancelled' ? 'background-color: #fff3cd; color: #856404;' : ''}
                                        ${deal.status === 'mixed' || deal.status === 'pending' ? 'background-color: #e2e3e5; color: #383d41;' : ''}
                                    ">
                                        ${(deal.status || 'pending').toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}

        ${commitments.topMembers && commitments.topMembers.length > 0 ? `
            <h2>🌟 Top 10 Members by Commitments</h2>
            <div class="card">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background-color: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Member Name</th>
                            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6;">Email</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Commitments</th>
                            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #dee2e6;">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${commitments.topMembers.map((member) => `
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 8px;">${member.memberName}</td>
                                <td style="padding: 8px;">${member.email}</td>
                                <td style="padding: 8px; text-align: right;">${member.commitments.toLocaleString()}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(member.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}

        <h2>📊 Activity & System Health (Previous Month)</h2>
        <div class="card">
            ${activity.byType && activity.byType.length > 0 ? `
                <h3>Logs by Type:</h3>
                <ul>
                    ${activity.byType.map(log => `
                        <li><strong>${log._id || 'Unknown'}:</strong> ${log.count.toLocaleString()}</li>
                    `).join('')}
                </ul>
            ` : ''}
            
            <ul>
                <li><strong>Total Error Logs:</strong> ${activity.errors.toLocaleString()}</li>
                <li><strong>Total Warning Logs:</strong> ${activity.warnings.toLocaleString()}</li>
            </ul>
        </div>

        ${activity.mostRepeatedErrors && activity.mostRepeatedErrors.length > 0 ? `
            <h2>⚠️ Most Repeated Errors</h2>
            <div class="card">
                <ul>
                    ${activity.mostRepeatedErrors.map((error, index) => `
                        <li style="margin-bottom: 15px;">
                            <strong>${index + 1}. [${error.count}x]</strong><br>
                            <span style="color: #721c24;">${error._id?.substring(0, 200) || 'Unknown'}</span>
                            ${error.action ? `<br><small style="color: #666;">Action: ${error.action}</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${activity.mostRepeatedWarnings && activity.mostRepeatedWarnings.length > 0 ? `
            <h2>⚠️ Most Repeated Warnings</h2>
            <div class="card">
                <ul>
                    ${activity.mostRepeatedWarnings.map((warning, index) => `
                        <li style="margin-bottom: 15px;">
                            <strong>${index + 1}. [${warning.count}x]</strong><br>
                            <span style="color: #856404;">${warning._id?.substring(0, 200) || 'Unknown'}</span>
                            ${warning.action ? `<br><small style="color: #666;">Action: ${warning.action}</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        <div class="alert-box alert-info" style="margin-top: 30px;">
            <p style="margin-bottom: 0;">
                <strong>Note:</strong> This is an automated monthly summary report for ${reportPeriod.monthName}. 
                A detailed PDF report with all deals and members is attached to this email.
            </p>
        </div>
    `);
};

module.exports = MonthlySummaryTemplate;
