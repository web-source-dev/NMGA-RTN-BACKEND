const cron = require('node-cron');
const { sendDailyCommitmentSummaries } = require('./dailyCommitmentSummary');
const { sendDailyCommitmentStatusSummaries } = require('./dailyCommitmentStatusSummary');
const { runDistributorReminders } = require('./distributorReminders');
const { runMemberCommitmentReminders, checkCommitmentWindowClosingReminders } = require('./memberCommitmentReminders');
const { sendMonthlySummary } = require('./monthlySummary');
const checkDealExpiration = require('./dealExpirationCheck');
// Schedule tasks
const initializeScheduler = () => {
    // Schedule daily commitment summary emails at 5:00 PM New Mexico Time
    cron.schedule('0 17 * * *', async () => {
        console.log('Running daily commitment summary task...');
        await sendDailyCommitmentSummaries();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule distributor reminders at 9:00 AM New Mexico Time (daily)
    cron.schedule('0 9 * * *', async () => {
    // cron.schedule('*/1 * * * *', async () => {
        console.log('Running distributor reminder checks...');
        await runDistributorReminders();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule member commitment reminders at 10:00 AM New Mexico Time (daily)
    cron.schedule('0 10 * * *', async () => {
    // cron.schedule('*/1 * * * *', async () => {
        console.log('Running member commitment reminder checks...');
        await runMemberCommitmentReminders();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule hourly member commitment reminders for 1-hour warnings
    cron.schedule('0 * * * *', async () => {
    // cron.schedule('*/1 * * * *', async () => {
        console.log('Running hourly member commitment reminder checks...');
        await checkCommitmentWindowClosingReminders();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule daily commitment status summary emails at 11:00 PM New Mexico Time
    cron.schedule('0 23 * * *', async () => {
        console.log('Running daily commitment status summary task...');
        await sendDailyCommitmentStatusSummaries();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule monthly summary report on the 1st of each month at 1:00 AM New Mexico Time
    // This sends the summary for the previous month
    // cron.schedule('*/1 * * * *', async () => {
    cron.schedule('0 1 1 * *', async () => {
        console.log('Running monthly summary report task...');
        await sendMonthlySummary();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });

    // Schedule deal expiration check on the 1st of each month at 1:00 AM New Mexico Time
    // cron.schedule('*/1 * * * *', async () => {
    cron.schedule('0 1 1 * *', async () => {
        console.log('Running deal expiration check task...');
        await checkDealExpiration();
    }, {
        timezone: "America/Denver" // Timezone for New Mexico (Mountain Time)
    });
};

module.exports = { initializeScheduler };
