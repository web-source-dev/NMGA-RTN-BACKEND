const Deal = require('../models/Deals');
const User = require('../models/User');
const Commitment = require('../models/Commitments');
const sendEmail = require('./email');
const { sendSMS } = require('./message');
const MemberReminderTemplate = require('./EmailTemplates/MemberReminderTemplate');
const DealMessages = require('./MessageTemplates/DealMessages');
const { isFeatureEnabled } = require('../config/features');
const { shouldSendCommitmentWindowOpeningReminders, shouldSendCommitmentWindowClosingReminders, getCurrentMonthSchedule } = require('./monthlySchedule');
const mongoose = require('mongoose');
const { logSystemAction } = require('./collaboratorLogger');

/**
 * Check for commitment windows that are opening tomorrow
 * Sends reminders 1 day before commitment window opens
 */
const checkCommitmentWindowOpeningReminders = async () => {
  try {
    // Check if member reminders feature is enabled
    if (!(await isFeatureEnabled('MEMBER_REMINDERS'))) {
      console.log('📧 Member reminders feature is disabled');
      return;
    }

    // Verify database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping member reminder check.');
      return;
    }

    // Check if we should send commitment window opening reminders based on monthly schedule
    const reminderInfo = shouldSendCommitmentWindowOpeningReminders();
    if (!reminderInfo) {
      console.log('📅 No commitment window opening reminders needed today');
      return;
    }

    const { currentMonth } = reminderInfo;
    console.log(`📅 Sending commitment window opening reminder for ${currentMonth.month} ${currentMonth.year}`);

    // Get all members (excluding distributors and admins)
    const members = await User.find({
      role: 'member',
      isBlocked: false
    });

    if (members.length === 0) {
      console.log('No active members found');
      return;
    }

    // Send reminders to all members
    for (const member of members) {
      try {
        // Send email reminder
        await sendEmail(
          member.email,
          `Commitment Window Opening Tomorrow - ${currentMonth.month} ${currentMonth.year}`,
          MemberReminderTemplate.commitmentWindowOpeningReminder(
            member.name,
            new Date(currentMonth.commitmentStart),
            new Date(currentMonth.commitmentEnd),
            currentMonth.month,
            currentMonth.year
          )
        );

        // Send SMS if phone number exists
        if (member.phone) {
          const smsMessage = DealMessages.memberCommitmentWindowOpening(
            new Date(currentMonth.commitmentStart),
            new Date(currentMonth.commitmentEnd),
            currentMonth.month,
            currentMonth.year
          );
          await sendSMS(member.phone, smsMessage);
        }

        // Log the reminder
        await logSystemAction('member_commitment_window_opening_reminder_sent', 'notification', {
          message: `Commitment window opening reminder sent to ${member.name} for ${currentMonth.month} ${currentMonth.year}`,
          userId: member._id,
          userName: member.name,
          userEmail: member.email,
          commitmentMonth: `${currentMonth.month} ${currentMonth.year}`,
          commitmentStartDate: currentMonth.commitmentStart,
          commitmentEndDate: currentMonth.commitmentEnd,
          severity: 'low',
          tags: ['notification', 'member', 'commitment-window', 'opening', 'automated']
        });

        console.log(`✅ Sent opening reminder to ${member.name} for ${currentMonth.month} ${currentMonth.year}`);

      } catch (error) {
        console.error(`Failed to send opening reminder to ${member.name}:`, error);
        
        await logSystemAction('member_commitment_window_opening_reminder_failed', 'notification', {
          message: `Failed to send commitment window opening reminder to ${member.name}`,
          userId: member._id,
          userName: member.name,
          userEmail: member.email,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'high',
          tags: ['notification', 'member', 'commitment-window', 'failed']
        });
      }
    }

  } catch (error) {
    console.error('Error in commitment window opening reminder check:', error);
    
    if (mongoose.connection.readyState === 1) {
      try {
        await logSystemAction('commitment_window_opening_reminder_check_failed', 'system', {
          message: `Error in commitment window opening reminder check: ${error.message}`,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'critical',
          tags: ['system', 'member', 'commitment-window', 'critical-error']
        });
      } catch (logError) {
        console.error('Failed to create error log:', logError);
      }
    }
  }
};

/**
 * Check for commitment windows that are closing soon
 * Sends reminders 5, 3, 1 days, and 1 hour before commitment window closes
 */
const checkCommitmentWindowClosingReminders = async () => {
  try {
    // Check if member reminders feature is enabled
    if (!(await isFeatureEnabled('MEMBER_REMINDERS'))) {
      console.log('📧 Member reminders feature is disabled');
      return;
    }

    // Verify database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping member reminder check.');
      return;
    }

    // Check if we should send commitment window closing reminders based on monthly schedule
    const reminderInfo = shouldSendCommitmentWindowClosingReminders();
    if (!reminderInfo) {
      console.log('📅 No commitment window closing reminders needed today');
      return;
    }

    const { currentMonth, timeRemaining, reminderType } = reminderInfo;
    console.log(`📅 Sending ${timeRemaining} closing reminder for ${currentMonth.month} ${currentMonth.year}`);

    // Get all members (excluding distributors and admins)
    const members = await User.find({
      role: 'member',
      isBlocked: false
    });

    if (members.length === 0) {
      console.log('No active members found');
      return;
    }

    // Send reminders to all members
    for (const member of members) {
      try {
        // Check if member has any commitments for this month's deals
        const memberCommitments = await Commitment.find({
          userId: member._id,
          // Find commitments for deals that match this month's commitment period
          dealId: { $in: await Deal.find({
            commitmentStartAt: {
              $gte: new Date(currentMonth.commitmentStart),
              $lt: new Date(new Date(currentMonth.commitmentStart).getTime() + 24 * 60 * 60 * 1000)
            },
            commitmentEndsAt: {
              $gte: new Date(currentMonth.commitmentEnd),
              $lt: new Date(new Date(currentMonth.commitmentEnd).getTime() + 24 * 60 * 60 * 1000)
            }
          }).distinct('_id') }
        });

        const hasCommitments = memberCommitments.length > 0;

        // Send email reminder
        await sendEmail(
          member.email,
          `Commitment Window Closing in ${timeRemaining} - ${currentMonth.month} ${currentMonth.year}`,
          MemberReminderTemplate.commitmentWindowClosingReminder(
            member.name,
            new Date(currentMonth.commitmentEnd),
            timeRemaining,
            hasCommitments,
            currentMonth.month,
            currentMonth.year
          )
        );

        // Send SMS if phone number exists
        if (member.phone) {
          const smsMessage = DealMessages.memberCommitmentWindowClosing(
            timeRemaining,
            new Date(currentMonth.commitmentEnd),
            hasCommitments,
            currentMonth.month,
            currentMonth.year
          );
          await sendSMS(member.phone, smsMessage);
        }

        // Log the reminder
        await logSystemAction('member_commitment_window_closing_reminder_sent', 'notification', {
          message: `${timeRemaining} commitment window closing reminder sent to ${member.name} for ${currentMonth.month} ${currentMonth.year}`,
          userId: member._id,
          userName: member.name,
          userEmail: member.email,
          commitmentMonth: `${currentMonth.month} ${currentMonth.year}`,
          timeRemaining,
          hasCommitments,
          commitmentsCount: memberCommitments.length,
          commitmentEndDate: currentMonth.commitmentEnd,
          severity: 'low',
          tags: ['notification', 'member', 'commitment-window', 'closing', 'automated']
        });

        console.log(`✅ Sent ${timeRemaining} closing reminder to ${member.name} for ${currentMonth.month} ${currentMonth.year}`);

      } catch (error) {
        console.error(`Failed to send ${timeRemaining} closing reminder to ${member.name}:`, error);
        
        await logSystemAction('member_commitment_window_closing_reminder_failed', 'notification', {
          message: `Failed to send ${timeRemaining} commitment window closing reminder to ${member.name}`,
          userId: member._id,
          userName: member.name,
          userEmail: member.email,
          timeRemaining,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'high',
          tags: ['notification', 'member', 'commitment-window', 'failed']
        });
      }
    }

  } catch (error) {
    console.error('Error in commitment window closing reminder check:', error);
    
    if (mongoose.connection.readyState === 1) {
      try {
        await logSystemAction('commitment_window_closing_reminder_check_failed', 'system', {
          message: `Error in commitment window closing reminder check: ${error.message}`,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'critical',
          tags: ['system', 'member', 'commitment-window', 'critical-error']
        });
      } catch (logError) {
        console.error('Failed to create error log:', logError);
      }
    }
  }
};

/**
 * Main function to run all member reminder checks
 */
const runMemberCommitmentReminders = async () => {
  console.log('🔄 Running member commitment reminder checks...');
  
  try {
    // Run commitment window opening reminders
    await checkCommitmentWindowOpeningReminders();
    
    // Run commitment window closing reminders
    await checkCommitmentWindowClosingReminders();
    
    console.log('✅ Member commitment reminder checks completed');
  } catch (error) {
    console.error('Error running member commitment reminders:', error);
  }
};

module.exports = {
  checkCommitmentWindowOpeningReminders,
  checkCommitmentWindowClosingReminders,
  runMemberCommitmentReminders
};
