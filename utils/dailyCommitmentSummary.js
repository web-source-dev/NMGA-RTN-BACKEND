const DailyCommitmentSummary = require('../models/DailyCommitmentSummary');
const User = require('../models/User');
const sendEmail = require('./email');
const { sendSMS } = require('./message');
const DailyCommitmentSummaryTemplate = require('./EmailTemplates/DailyCommitmentSummaryTemplate');
const { isFeatureEnabled } = require('../config/features');
const { logSystemAction } = require('./collaboratorLogger');

const sendDailyCommitmentSummaries = async () => {
    try {
        // Check if daily summaries feature is enabled
        if (!(await isFeatureEnabled('DAILY_SUMMARIES'))) {
            console.log('📊 Daily commitment summaries feature is disabled');
            await logSystemAction('daily_commitment_summaries_disabled', 'system', {
                message: 'Daily commitment summaries feature is disabled',
                severity: 'low',
                tags: ['daily-summary', 'feature-disabled']
            });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all unsent summaries for today
        const summaries = await DailyCommitmentSummary.find({
            date: today,
            emailSent: false
        })
        .populate('userId', 'name email phone')
        .populate('distributorId', 'name email businessName phone')
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
                
                if (admin.phone) {
                    try {
                        const adminSmsMessage = `NMGA Daily Summary: ${summaries.length} commitment report${summaries.length === 1 ? '' : 's'} emailed for ${today.toLocaleDateString()}.`;
                        await sendSMS(admin.phone, adminSmsMessage);
                    } catch (error) {
                        console.error('Failed to send admin daily summary SMS:', error);
                    }
                }
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
                
                if (summary.userId.phone) {
                    try {
                        const userSmsMessage = `NMGA: You made ${summary.totalCommitments || summary.commitments.length} commitment${(summary.totalCommitments || summary.commitments.length) === 1 ? '' : 's'} totaling $${Number(summary.totalAmount || 0).toFixed(2)} today. Details in your email.`;
                        await sendSMS(summary.userId.phone, userSmsMessage);
                    } catch (error) {
                        console.error('Failed to send member daily summary SMS:', error);
                    }
                }
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
                
                if (summary.distributorId.phone) {
                    try {
                        const distributorSmsMessage = `NMGA: ${summary.totalCommitments} commitment${summary.totalCommitments === 1 ? '' : 's'} today totaling $${Number(summary.totalAmount || 0).toFixed(2)}. Full report emailed.`;
                        await sendSMS(summary.distributorId.phone, distributorSmsMessage);
                    } catch (error) {
                        console.error('Failed to send distributor daily summary SMS:', error);
                    }
                }
            }

            // Mark summary as sent
            summary.emailSent = true;
            await summary.save();
        }

        console.log(`Successfully sent ${summaries.length} daily commitment summaries`);
        
        await logSystemAction('daily_commitment_summaries_completed', 'email', {
            message: `Successfully sent ${summaries.length} daily commitment summaries`,
            summariesSent: summaries.length,
            severity: 'low',
            tags: ['daily-summary', 'email', 'automated', 'completed']
        });
    } catch (error) {
        console.error('Error sending daily commitment summaries:', error);
        
        await logSystemAction('daily_commitment_summaries_failed', 'system', {
            message: `Error sending daily commitment summaries: ${error.message}`,
            error: {
                message: error.message,
                stack: error.stack
            },
            severity: 'critical',
            tags: ['daily-summary', 'system-error', 'failed']
        });
    }
};

module.exports = { sendDailyCommitmentSummaries }; 