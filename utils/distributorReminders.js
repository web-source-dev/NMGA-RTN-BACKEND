const Deal = require('../models/Deals');
const User = require('../models/User');
const Commitment = require('../models/Commitments');
const Log = require('../models/Logs');
const sendEmail = require('./email');
const { sendSMS } = require('./message');
const DistributorReminderTemplate = require('./EmailTemplates/DistributorReminderTemplate');
const DealMessages = require('./MessageTemplates/DealMessages');
const { isFeatureEnabled } = require('../config/features');
const { shouldSendPostingReminders, getNextMonthName } = require('./monthlySchedule');
const mongoose = require('mongoose');
const { logSystemAction } = require('./collaboratorLogger');

/**
 * Check for monthly posting deadline reminders
 * Sends reminders 5, 3, and 1 days before the monthly posting deadline
 */
const checkPostingDeadlineReminders = async () => {
  try {
    // Check if distributor reminders feature is enabled
    if (!(await isFeatureEnabled('DISTRIBUTOR_REMINDERS'))) {
      console.log('📧 Distributor reminders feature is disabled');
      return;
    }

    // Verify database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping distributor reminder check.');
      return;
    }

    // Check if we should send posting reminders based on monthly schedule
    const reminderInfo = shouldSendPostingReminders();
    if (!reminderInfo) {
      console.log('📅 No posting deadline reminders needed today');
      return;
    }

    const { nextMonth, daysUntilDeadline, reminderType } = reminderInfo;
    const deliveryMonth = getNextMonthName(nextMonth.month, nextMonth.year);
    
    console.log(`📅 Sending ${daysUntilDeadline}-day posting reminder for ${deliveryMonth.month} ${deliveryMonth.year}`);

    // Get all distributors
    const distributors = await User.find({
      role: 'distributor',
      isBlocked: false
    });

    if (distributors.length === 0) {
      console.log('No active distributors found');
      return;
    }

    // Track statistics
    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;
    const sentToEmails = [];
    const failedEmails = [];
    const skippedEmails = [];

    // Send reminders to all distributors
    for (const distributor of distributors) {
      try {
        const distributorName = distributor.businessName || distributor.name;
        
        // Check if this distributor has already received this reminder for this month/year
        // Use unique tag for duplicate detection (includes daysUntilDeadline to differentiate 5, 3, 1 day reminders)
        const uniqueTag = `posting-${daysUntilDeadline}day-${deliveryMonth.month}-${deliveryMonth.year}`;
        const twentyDaysAgo = new Date();
        twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
        
        const existingReminder = await Log.findOne({
          "metadata.userId": distributor._id,
          "metadata.userEmail": distributor.email,
          action: 'distributor_posting_reminder_sent',
          tags: { $in: [uniqueTag] },
          createdAt: { $gte: twentyDaysAgo }
        }).select('_id createdAt').lean();

        if (existingReminder) {
          console.log(`⏭️ Skipping ${daysUntilDeadline}-day posting reminder for ${distributorName} - already sent for ${deliveryMonth.month} ${deliveryMonth.year} on ${new Date(existingReminder.createdAt).toLocaleString()}`);
          emailsSkipped++;
          skippedEmails.push(distributor.email);
          continue;
        }
        
        // Send email reminder
        await sendEmail(
          distributor.email,
          `Deal Posting Reminder - ${daysUntilDeadline} Days Remaining for ${deliveryMonth.month} ${deliveryMonth.year}`,
          DistributorReminderTemplate.postingDeadlineReminder(
            distributorName, 
            [], // No specific deals, this is a monthly reminder
            reminderType,
            deliveryMonth.month,
            deliveryMonth.year,
            nextMonth.deadline,
            nextMonth.commitmentStart,
            nextMonth.commitmentEnd
          )
        );

        // Send SMS if phone number exists
        if (distributor.phone) {
          const smsMessage = DealMessages.distributorPostingReminder(
            daysUntilDeadline, 
            [], // No specific deals
            deliveryMonth.month,
            deliveryMonth.year,
            nextMonth.deadline
          );
          
          await sendSMS(distributor.phone, smsMessage);
        }

        // Log the reminder with unique tag to prevent future duplicates
        await logSystemAction('distributor_posting_reminder_sent', 'notification', {
          message: `${daysUntilDeadline}-day posting reminder sent to ${distributorName} for ${deliveryMonth.month} ${deliveryMonth.year}`,
          userId: distributor._id,
          userName: distributorName,
          userEmail: distributor.email,
          daysUntilDeadline,
          deliveryMonth: `${deliveryMonth.month} ${deliveryMonth.year}`,
          deadlineDate: nextMonth.deadline,
          severity: 'low',
          tags: ['notification', 'distributor', 'posting-reminder', 'automated', uniqueTag]
        });

        emailsSent++;
        sentToEmails.push(distributor.email);
        console.log(`✅ Sent ${daysUntilDeadline}-day posting reminder to ${distributorName} for ${deliveryMonth.month} ${deliveryMonth.year}`);

      } catch (error) {
        console.error(`Failed to send ${daysUntilDeadline}-day reminder to ${distributor.name}:`, error);
        
        emailsFailed++;
        failedEmails.push(distributor.email);

        await logSystemAction('distributor_posting_reminder_failed', 'notification', {
          message: `Failed to send ${daysUntilDeadline}-day posting reminder to ${distributor.name}`,
          userId: distributor._id,
          userName: distributor.name,
          userEmail: distributor.email,
          daysUntilDeadline,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'high',
          tags: ['notification', 'distributor', 'posting-reminder', 'failed']
        });
      }
    }

    // Log overall summary
    const summaryMessage = `Posting deadline ${daysUntilDeadline}-day reminders completed for ${deliveryMonth.month} ${deliveryMonth.year}. Total Distributors: ${distributors.length}, Sent: ${emailsSent}, Failed: ${emailsFailed}, Skipped: ${emailsSkipped}`;
    console.log(`📊 ${summaryMessage}`);
    
    await logSystemAction('distributor_posting_reminders_summary', 'notification', {
      message: summaryMessage,
      deliveryMonth: `${deliveryMonth.month} ${deliveryMonth.year}`,
      daysUntilDeadline,
      totalDistributors: distributors.length,
      emailsSent,
      emailsFailed,
      emailsSkipped,
      sentToEmails,
      failedEmails,
      skippedEmails,
      severity: emailsFailed > 0 ? 'medium' : 'low',
      tags: ['notification', 'distributor', 'posting-reminder', 'automated', 'summary']
    });

  } catch (error) {
    console.error('Error in posting deadline reminder check:', error);
    
    if (mongoose.connection.readyState === 1) {
      try {
        await logSystemAction('posting_deadline_reminder_check_failed', 'system', {
          message: `Error in posting deadline reminder check: ${error.message}`,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'critical',
          tags: ['system', 'distributor', 'posting-reminder', 'critical-error']
        });
      } catch (logError) {
        console.error('Failed to create error log:', logError);
      }
    }
  }
};

/**
 * Check for deals that need approval reminders
 * Sends reminders 5 days after commitment window closes
 */
const checkApprovalReminders = async () => {
  try {
    // Check if distributor reminders feature is enabled
    if (!(await isFeatureEnabled('DISTRIBUTOR_REMINDERS'))) {
      console.log('📧 Distributor reminders feature is disabled');
      return;
    }

    // Verify database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping approval reminder check.');
      return;
    }

    const currentDate = new Date();
    
    // Calculate date 5 days after commitment window closed
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(currentDate.getDate() - 5);
    
    // Find deals where:
    // 1. Commitment window ended 5 days ago
    // 2. Deal has commitments
    // 3. Deal is still active (not yet approved/processed)
    // 4. Haven't sent approval reminder yet
    const dealsNeedingApproval = await Deal.find({
      commitmentEndsAt: {
        $gte: new Date(fiveDaysAgo.getFullYear(), fiveDaysAgo.getMonth(), fiveDaysAgo.getDate()),
        $lt: new Date(fiveDaysAgo.getFullYear(), fiveDaysAgo.getMonth(), fiveDaysAgo.getDate() + 1)
      },
      status: 'active', // Deal is active but needs approval
      commitments: { $exists: true, $not: { $size: 0 } }, // Has commitments
      $or: [
        { 'distributorReminders.approvalReminders': { $exists: false } },
        { 'distributorReminders.approvalReminders.5_days_after_commitment': { $exists: false } }
      ]
    })
    .populate('distributor', 'name email businessName phone')
    .populate('commitments');

    if (dealsNeedingApproval.length === 0) {
      console.log('No deals found needing approval reminders');
      return;
    }

    // Group deals by distributor
    const distributorDealsMap = new Map();
    
    for (const deal of dealsNeedingApproval) {
      const distributorId = deal.distributor._id.toString();
      
      if (!distributorDealsMap.has(distributorId)) {
        distributorDealsMap.set(distributorId, {
          distributor: deal.distributor,
          deals: []
        });
      }
      
      distributorDealsMap.get(distributorId).deals.push(deal);
    }

    // Track statistics for approval reminders
    let approvalEmailsSent = 0;
    let approvalEmailsFailed = 0;
    let approvalEmailsSkipped = 0;
    const approvalSentToEmails = [];
    const approvalFailedEmails = [];
    const approvalSkippedEmails = [];

    // Send reminders to each distributor
    for (const [distributorId, { distributor, deals }] of distributorDealsMap.entries()) {
      try {
        const distributorName = distributor.businessName || distributor.name;
        
        // Create unique tags for each deal to prevent duplicate reminders for same deals
        const dealIds = deals.map(d => d._id.toString()).sort().join('-');
        const uniqueTag = `approval-5days-${dealIds.substring(0, 20)}`; // Use first 20 chars of deal IDs hash
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Check if this distributor has already been notified about these deals
        const existingReminder = await Log.findOne({
          "metadata.userId": distributor._id,
          "metadata.userEmail": distributor.email,
          action: 'distributor_approval_reminder_sent',
          tags: { $in: [uniqueTag] },
          createdAt: { $gte: sevenDaysAgo }
        }).select('_id createdAt').lean();

        if (existingReminder) {
          console.log(`⏭️ Skipping approval reminder for ${distributorName} - already sent for these ${deals.length} deals on ${new Date(existingReminder.createdAt).toLocaleString()}`);
          approvalEmailsSkipped++;
          approvalSkippedEmails.push(distributor.email);
          continue;
        }
        
        // Send email reminder
        await sendEmail(
          distributor.email,
          'Deal Approval Reminder - Commitments Awaiting Review',
          DistributorReminderTemplate.dealApprovalReminder(distributorName, deals)
        );

        // Send SMS if phone number exists
        if (distributor.phone) {
          const totalCommitments = deals.reduce((sum, deal) => sum + (deal.commitments ? deal.commitments.length : 0), 0);
          const smsMessage = DealMessages.distributorApprovalReminder(deals.length, totalCommitments);
          
          await sendSMS(distributor.phone, smsMessage);
        }

        // Record reminder sent for each deal
        for (const deal of deals) {
          if (!deal.distributorReminders.approvalReminders.has('5_days_after_commitment')) {
            deal.distributorReminders.approvalReminders.set('5_days_after_commitment', []);
          }
          
          deal.distributorReminders.approvalReminders.get('5_days_after_commitment').push({
            reminderType: '5_days_after_commitment',
            sentAt: new Date()
          });
          
          await deal.save();
        }

        // Log the reminder with unique tag to prevent future duplicates
        await logSystemAction('distributor_approval_reminder_sent', 'notification', {
          message: `Approval reminder sent to ${distributorName} for ${deals.length} deal(s) with commitments`,
          userId: distributor._id,
          userName: distributorName,
          userEmail: distributor.email,
          dealsCount: deals.length,
          totalCommitments: deals.reduce((sum, deal) => sum + (deal.commitments ? deal.commitments.length : 0), 0),
          dealIds: deals.map(d => d._id.toString()),
          severity: 'low',
          tags: ['notification', 'distributor', 'approval-reminder', 'automated', uniqueTag]
        });

        approvalEmailsSent++;
        approvalSentToEmails.push(distributor.email);
        console.log(`✅ Sent approval reminder to ${distributorName} for ${deals.length} deals`);

      } catch (error) {
        console.error(`Failed to send approval reminder to ${distributor.name}:`, error);
        
        approvalEmailsFailed++;
        approvalFailedEmails.push(distributor.email);

        await logSystemAction('distributor_approval_reminder_failed', 'notification', {
          message: `Failed to send approval reminder to ${distributor.name}`,
          userId: distributor._id,
          userName: distributor.name,
          userEmail: distributor.email,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'high',
          tags: ['notification', 'distributor', 'approval-reminder', 'failed']
        });
      }
    }

    // Log overall summary for approval reminders
    const approvalSummaryMessage = `Distributor approval reminders completed. Total Distributors: ${distributorDealsMap.size}, Total Deals: ${dealsNeedingApproval.length}, Sent: ${approvalEmailsSent}, Failed: ${approvalEmailsFailed}, Skipped: ${approvalEmailsSkipped}`;
    console.log(`📊 ${approvalSummaryMessage}`);
    
    await logSystemAction('distributor_approval_reminders_summary', 'notification', {
      message: approvalSummaryMessage,
      totalDistributors: distributorDealsMap.size,
      totalDeals: dealsNeedingApproval.length,
      emailsSent: approvalEmailsSent,
      emailsFailed: approvalEmailsFailed,
      emailsSkipped: approvalEmailsSkipped,
      sentToEmails: approvalSentToEmails,
      failedEmails: approvalFailedEmails,
      skippedEmails: approvalSkippedEmails,
      severity: approvalEmailsFailed > 0 ? 'medium' : 'low',
      tags: ['notification', 'distributor', 'approval-reminder', 'automated', 'summary']
    });

  } catch (error) {
    console.error('Error in approval reminder check:', error);
    
    if (mongoose.connection.readyState === 1) {
      try {
        await logSystemAction('approval_reminder_check_failed', 'system', {
          message: `Error in approval reminder check: ${error.message}`,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'critical',
          tags: ['system', 'distributor', 'approval-reminder', 'critical-error']
        });
      } catch (logError) {
        console.error('Failed to create error log:', logError);
      }
    }
  }
};

/**
 * Main function to run all distributor reminder checks
 */
const runDistributorReminders = async () => {
  console.log('🔄 Running distributor reminder checks...');
  
  try {
    // Run posting deadline reminders
    await checkPostingDeadlineReminders();
    
    // Run approval reminders
    await checkApprovalReminders();
    
    console.log('✅ Distributor reminder checks completed');
  } catch (error) {
    console.error('Error running distributor reminders:', error);
  }
};

module.exports = {
  checkPostingDeadlineReminders,
  checkApprovalReminders,
  runDistributorReminders
};
