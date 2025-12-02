const cron = require('node-cron');
const { sendDailyCommitmentSummaries } = require('./dailyCommitmentSummary');
const { sendDailyCommitmentStatusSummaries } = require('./dailyCommitmentStatusSummary');
const { runDistributorReminders } = require('./distributorReminders');
const { runMemberCommitmentReminders, checkCommitmentWindowClosingReminders } = require('./memberCommitmentReminders');
const { sendMonthlySummary } = require('./monthlySummary');
const checkDealExpiration = require('./dealExpirationCheck');
// Helper function to wrap scheduled tasks with error handling
const scheduleTask = (name, cronExpression, taskFn, options = {}) => {
    cron.schedule(cronExpression, async () => {
        const startTime = Date.now();
        console.log(`[${new Date().toISOString()}] Starting: ${name}...`);
        
        try {
            await taskFn();
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`[${new Date().toISOString()}] ✓ ${name} completed successfully in ${duration}s`);
        } catch (error) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.error(`[${new Date().toISOString()}] ✗ ${name} failed after ${duration}s`);
            console.error(`Error in ${name}:`, {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Try to log the error to the database if possible
            try {
                const { logSystemAction } = require('./collaboratorLogger');
                await logSystemAction(`scheduler_${name.toLowerCase().replace(/\s+/g, '_')}_failed`, 'system', {
                    message: `Scheduled task ${name} failed: ${error.message}`,
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    },
                    severity: 'critical',
                    tags: ['scheduler', 'error', 'automated']
                });
            } catch (logError) {
                console.error(`Failed to log error for ${name}:`, logError);
            }
        }
    }, {
        timezone: "America/Denver", // Timezone for New Mexico (Mountain Time)
        ...options
    });
};

// Schedule tasks
const initializeScheduler = () => {
    // Schedule daily commitment summary emails at 5:00 PM New Mexico Time
    scheduleTask('Daily Commitment Summary', '0 17 * * *', sendDailyCommitmentSummaries);

    // Schedule distributor reminders at 9:00 AM New Mexico Time (daily)
    scheduleTask('Distributor Reminders', '0 9 * * *', runDistributorReminders);
    // For testing: scheduleTask('Distributor Reminders', '*/1 * * * *', runDistributorReminders);

    // Schedule member commitment reminders at 10:00 AM New Mexico Time (daily)
    scheduleTask('Member Commitment Reminders', '0 10 * * *', runMemberCommitmentReminders);
    // For testing: scheduleTask('Member Commitment Reminders', '*/1 * * * *', runMemberCommitmentReminders);

    // Schedule hourly member commitment reminders for 1-hour warnings
    scheduleTask('Commitment Window Closing Reminders', '0 * * * *', checkCommitmentWindowClosingReminders);
    // For testing: scheduleTask('Commitment Window Closing Reminders', '*/1 * * * *', checkCommitmentWindowClosingReminders);

    // Schedule daily commitment status summary emails at 11:00 PM New Mexico Time
    scheduleTask('Daily Commitment Status Summary', '0 23 * * *', sendDailyCommitmentStatusSummaries);

    // Schedule monthly summary report on the 1st of each month at 1:00 AM New Mexico Time
    // This sends the summary for the previous month
    scheduleTask('Monthly Summary Report', '0 1 1 * *', sendMonthlySummary);
    // For testing: scheduleTask('Monthly Summary Report', '*/1 * * * *', sendMonthlySummary);

    // Schedule deal expiration check on the 1st of each month at 1:00 AM New Mexico Time
    scheduleTask('Deal Expiration Check', '0 1 1 * *', checkDealExpiration);
    // For testing: scheduleTask('Deal Expiration Check', '*/1 * * * *', checkDealExpiration);
    
    console.log('✅ Scheduler initialized with all tasks');
};

module.exports = { initializeScheduler };
