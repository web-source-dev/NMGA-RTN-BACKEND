const DailyCommitmentSummary = require('../models/DailyCommitmentSummary');
const User = require('../models/User');
const sendEmail = require('./email');
const DailyCommitmentSummaryTemplate = require('./EmailTemplates/DailyCommitmentSummaryTemplate');

const sendDailyCommitmentSummaries = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all unsent summaries for today
        const summaries = await DailyCommitmentSummary.find({
            date: today,
            emailSent: false
        })
        .populate('userId', 'name email')
        .populate('distributorId', 'name email businessName')
        .populate({
            path: 'commitments.commitmentId',
            populate: {
                path: 'userId',
                select: 'name'
            }
        });

        if (!summaries.length) {
            console.log('No unsent summaries found for today');
            return;
        }

        // Group summaries by distributor for admin report
        const distributorSummaries = {};
        for (const summary of summaries) {
            if (!distributorSummaries[summary.distributorId._id]) {
                distributorSummaries[summary.distributorId._id] = {
                    distributorName: summary.distributorId.businessName || summary.distributorId.name,
                    totalCommitments: 0,
                    totalQuantity: 0,
                    totalAmount: 0,
                    uniqueMembers: new Set()
                };
            }
            
            const distSummary = distributorSummaries[summary.distributorId._id];
            distSummary.totalCommitments += summary.totalCommitments;
            distSummary.totalQuantity += summary.totalQuantity;
            distSummary.totalAmount += summary.totalAmount;
            distSummary.uniqueMembers.add(summary.userId._id.toString());
        }

        // Convert distributor summaries for admin template
        const adminSummaryData = Object.values(distributorSummaries).map(summary => ({
            ...summary,
            uniqueMembers: summary.uniqueMembers.size
        }));

        // Send summary to admin
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            if (admin.email) {
                await sendEmail(
                    admin.email,
                    'Daily Platform Commitment Summary',
                    DailyCommitmentSummaryTemplate.admin(adminSummaryData)
                );
            }
        }

        // Send summaries to users and distributors
        for (const summary of summaries) {
            // Send to user
            if (summary.userId.email) {
                await sendEmail(
                    summary.userId.email,
                    'Your Daily Commitment Summary',
                    DailyCommitmentSummaryTemplate.user(
                        summary.userId.name,
                        summary.commitments,
                        summary.totalAmount,
                        summary.totalQuantity
                    )
                );
            }

            // Send to distributor
            if (summary.distributorId.email) {
                const distributorCommitments = summary.commitments.map(c => ({
                    ...c,
                    userName: c.commitmentId.userId.name
                }));

                await sendEmail(
                    summary.distributorId.email,
                    'Daily Commitment Summary Report',
                    DailyCommitmentSummaryTemplate.distributor(
                        summary.distributorId.businessName || summary.distributorId.name,
                        distributorCommitments,
                        summary.totalAmount,
                        summary.totalQuantity
                    )
                );
            }

            // Mark summary as sent
            summary.emailSent = true;
            await summary.save();
        }

        console.log(`Successfully sent ${summaries.length} daily commitment summaries`);
    } catch (error) {
        console.error('Error sending daily commitment summaries:', error);
    }
};

module.exports = { sendDailyCommitmentSummaries }; 