const cron = require('node-cron');
const { sendDailyCommitmentSummaries } = require('./dailyCommitmentSummary');

// Schedule tasks
const initializeScheduler = () => {
    // Schedule daily commitment summary emails at 5:00 PM Pakistan Time
    cron.schedule('59 23 * * *', async () => {
        console.log('Running daily commitment summary task...');
        await sendDailyCommitmentSummaries();
    }, {
        timezone: "Asia/Karachi" // Timezone for Pakistan
    });
};

module.exports = { initializeScheduler };
