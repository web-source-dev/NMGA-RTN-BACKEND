# Monthly Report Generation Documentation

## Overview
The NMGA platform generates comprehensive monthly summary reports that are automatically sent via email at the end of each month. These reports provide a complete overview of platform activity, user engagement, deals, commitments, and system health.

## Report Generation Process

### 1. **Automatic Scheduling**
- **Schedule**: Runs automatically on the **1st of each month at 1:00 AM New Mexico Time (America/Denver timezone)**
- **Frequency**: Monthly
- **Trigger**: Cron job scheduled in `backend/utils/scheduler.js`
- **Recipient**: `muhammadnouman72321@gmail.com`

### 2. **Report Period**
- The report covers the **previous month** (e.g., if run on February 1st, it reports January data)
- Report period is calculated from the 1st day of the previous month at 00:00:00 to the last day at 23:59:59

### 3. **Data Collection**
The report collects data from the following models:
- **User Model**: User statistics, roles, collaborators
- **Deal Model**: Deal statistics, views, impressions, categories
- **Commitment Model**: Commitment statistics, revenue, quantities, status
- **Payment Model**: Payment statistics (if payments are processed)
- **Log Model**: System activity logs, errors, warnings
- **CommitmentStatusChange Model**: Status change tracking
- **DailyCommitmentSummary Model**: Daily summary statistics

## Report Contents

### 📊 Executive Summary
- Total Users
- Active Deals
- Total Commitments
- Total Revenue
- Revenue Growth Percentage (compared to previous month)

### 👥 User Statistics
1. **Total Users**: Complete count of all users in the system
2. **New Users This Month**: Users created during the report period
3. **Active Users**: Users who are not blocked
4. **Blocked Users**: Users who are currently blocked
5. **Total Collaborators**: Count of all collaborator accounts across all distributors/members
6. **Users by Role**: Breakdown by role (admin, distributor, member)
7. **Growth Percentage**: Month-over-month user growth

### 💼 Deal Statistics
1. **Total Deals**: Complete count of all deals in the system
2. **New Deals This Month**: Deals created during the report period
3. **Active Deals**: Deals with status 'active'
4. **Inactive Deals**: Deals with status 'inactive'
5. **Total Views**: Sum of all deal views
6. **Total Impressions**: Sum of all deal impressions
7. **Deals by Category**: Breakdown of deals by category
8. **Top Distributors**: Top 10 distributors by number of deals
9. **Growth Percentage**: Month-over-month deal creation growth

### 📝 Commitment Statistics
1. **Total Commitments**: Complete count of all commitments
2. **New Commitments This Month**: Commitments created during the report period
3. **Total Revenue**: Sum of all approved commitment revenues
4. **Total Quantity Committed**: Sum of all quantities from approved commitments
5. **Status Changes This Month**: Count of commitment status changes
6. **Commitments by Status**: Breakdown by status (pending, approved, declined, cancelled)
7. **Top 10 Deals by Commitments**: 
   - Deal name
   - Distributor name
   - Number of commitments
   - Total revenue generated
8. **Top 10 Members by Commitments**:
   - Member name
   - Email address
   - Number of commitments
   - Total revenue spent
9. **Growth Percentage**: Month-over-month commitment growth

### 💳 Payment Statistics (if available)
1. **Total Payments**: Complete count of all payments
2. **Payments This Month**: Payments processed during the report period
3. **Payment Revenue**: Total revenue from completed payments
4. **Payments by Status**: Breakdown by payment status (pending, completed, failed, refunded)

### 📊 Activity & System Health
1. **Total Logs**: Complete count of system logs
2. **Logs This Month**: Logs generated during the report period
3. **Error Logs**: Count of error-level logs
4. **Critical Logs**: Count of critical-severity logs
5. **Logs by Type**: Breakdown by log type (info, success, error, warning)

### 📧 Daily Summaries
1. **Total Summaries Generated**: Count of daily commitment summaries created
2. **Summaries Sent**: Count of successfully sent summaries
3. **Pending Summaries**: Count of summaries not yet sent

## Report Generation Details

### Data Aggregation Methods

#### User Statistics
- Uses MongoDB `countDocuments()` for counts
- Uses MongoDB `aggregate()` with `$group` for role-based statistics
- Calculates collaborator count by summing all collaborators across all users

#### Deal Statistics
- Aggregates views and impressions using `$sum`
- Groups deals by category for distribution analysis
- Identifies top distributors by deal count and engagement metrics

#### Commitment Statistics
- Calculates revenue from approved commitments using `$sum` on `totalPrice`
- Calculates total quantity by unwinding `sizeCommitments` array and summing quantities
- Groups commitments by status for breakdown
- Identifies top deals and members using aggregation pipelines with sorting and limiting

#### Growth Calculations
- Compares current month metrics with previous month
- Calculates percentage growth: `((current - previous) / previous) * 100`
- Handles edge cases where previous month had zero values

### Email Template
The report is formatted using a responsive HTML email template that includes:
- Professional styling with NMGA branding
- Color-coded sections for easy reading
- Tables for top performers (deals and members)
- Alert boxes for key metrics
- Mobile-responsive design

## File Structure

```
backend/
├── utils/
│   ├── monthlySummary.js          # Main report generation service
│   ├── scheduler.js                # Cron job scheduling (includes monthly task)
│   └── EmailTemplates/
│       └── MonthlySummaryTemplate.js  # Email template for the report
└── docs/
    └── MONTHLY_REPORT_DOCUMENTATION.md  # This documentation
```

## Usage

### Manual Execution
If you need to manually generate and send a monthly report:

```javascript
const { sendMonthlySummary } = require('./utils/monthlySummary');
await sendMonthlySummary();
```

### Testing
To test the report generation with a specific date range:

```javascript
const { generateMonthlySummary } = require('./utils/monthlySummary');

const startDate = new Date('2025-01-01');
const endDate = new Date('2025-01-31');
const summary = await generateMonthlySummary(startDate, endDate);
console.log(summary);
```

## Error Handling

The service includes comprehensive error handling:
- All database queries are wrapped in try-catch blocks
- Errors are logged using the system logging service
- Email sending failures are captured and logged
- The system continues to operate even if monthly report generation fails

## Logging

The monthly summary service logs:
- Success: When report is generated and sent successfully
- Failure: When report generation or email sending fails
- Logs include report period, error messages, and severity levels

## Future Enhancements

Potential improvements for the monthly report:
1. Export to PDF format
2. Include charts and graphs
3. Add comparison with same month previous year
4. Include detailed trend analysis
5. Add custom date range reports
6. Support multiple recipient emails
7. Add report delivery via alternative channels (SMS, API)

## Notes

- Reports are generated asynchronously to avoid blocking the main application
- The email service respects the feature flag system (EMAIL feature must be enabled)
- All currency values are formatted in USD ($)
- All numbers are formatted with locale-specific thousand separators
- The report includes a timestamp of when it was generated

