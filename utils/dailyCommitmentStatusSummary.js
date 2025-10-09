const CommitmentStatusChange = require('../models/CommitmentStatusChange');
const User = require('../models/User');
const sendEmail = require('./email');
const { generateDailyCommitmentStatusSummary } = require('./EmailTemplates/DailyCommitmentStatusSummaryTemplate');
const { isFeatureEnabled } = require('../config/features');
const { logSystemAction, logError } = require('./collaboratorLogger');

/**
 * Send daily commitment status summary emails to members
 * This function processes all unprocessed status changes from today
 * and sends one consolidated email per member
 */
const sendDailyCommitmentStatusSummaries = async () => {
  try {
    console.log('🔄 Starting daily commitment status summary process...');
    
    // Check if email feature is enabled
    if (!(await isFeatureEnabled('EMAIL'))) {
      console.log('📧 Email feature is disabled. Skipping daily commitment status summaries.');
      return;
    }

    // Get today's date range (start and end of day in New Mexico time)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    console.log(`📅 Processing status changes from ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Find all unprocessed status changes from today
    const statusChanges = await CommitmentStatusChange.find({
      createdAt: { $gte: todayStart, $lte: todayEnd },
      processedForEmail: false
    }).populate('userId', 'name email businessName');

    if (statusChanges.length === 0) {
      console.log('📭 No unprocessed status changes found for today.');
      return;
    }

    console.log(`📊 Found ${statusChanges.length} unprocessed status changes`);

    // Group status changes by user
    const userStatusChanges = {};
    statusChanges.forEach(change => {
      const userId = change.userId._id.toString();
      if (!userStatusChanges[userId]) {
        userStatusChanges[userId] = {
          user: change.userId,
          changes: []
        };
      }
      userStatusChanges[userId].changes.push(change);
    });

    console.log(`👥 Processing summaries for ${Object.keys(userStatusChanges).length} members`);

    let emailsSent = 0;
    let emailsFailed = 0;

    // Process each user's status changes
    for (const [userId, userData] of Object.entries(userStatusChanges)) {
      try {
        const { user, changes } = userData;
        
        // Separate approved and declined changes
        const approvedChanges = changes.filter(change => change.newStatus === 'approved');
        const declinedChanges = changes.filter(change => change.newStatus === 'declined');

        // Calculate totals
        const totalApprovedValue = approvedChanges.reduce((sum, change) => 
          sum + (change.commitmentDetails.totalPrice || 0), 0);
        const totalDeclinedValue = declinedChanges.reduce((sum, change) => 
          sum + (change.commitmentDetails.totalPrice || 0), 0);

        // Prepare summary data
        const summaryData = {
          approvedCommitments: approvedChanges,
          declinedCommitments: declinedChanges,
          totalApprovedValue,
          totalDeclinedValue
        };

        // Generate email content
        const memberName = user.businessName || user.name;
        const emailHtml = generateDailyCommitmentStatusSummary(memberName, summaryData);
        
        // Send email
        const subject = `Daily Commitment Status Update - ${approvedChanges.length} Approved, ${declinedChanges.length} Declined`;
        
        console.log(`📧 Sending summary email to ${user.email} (${memberName})`);
        await sendEmail(user.email, subject, emailHtml);
        
        // Mark all changes as processed
        const changeIds = changes.map(change => change._id);
        await CommitmentStatusChange.updateMany(
          { _id: { $in: changeIds } },
          { 
            processedForEmail: true,
            emailSentAt: new Date()
          }
        );

        emailsSent++;

      } catch (error) {
        emailsFailed++;
        console.error(`❌ Failed to send summary email to user ${userId}:`, error);
        
        // Log the error
        await logSystemAction('send_daily_commitment_status_summary_failed', 'email', {
          message: `Failed to send daily commitment status summary to user ${userId}: ${error.message}`,
          userId: userId,
          userName: userData.user?.name,
          userEmail: userData.user?.email,
          error: {
            message: error.message,
            stack: error.stack
          },
          severity: 'high',
          tags: ['email', 'daily-summary', 'commitment-status']
        });
      }
    }

    // Log summary
    const summaryMessage = `Daily commitment status summary completed. Emails sent: ${emailsSent}, Failed: ${emailsFailed}`;
    console.log(`📊 ${summaryMessage}`);
    
    await logSystemAction('send_daily_commitment_status_summaries_completed', 'email', {
      message: summaryMessage,
      emailsSent,
      emailsFailed,
      totalStatusChanges: statusChanges.length,
      totalUsers: Object.keys(userStatusChanges).length,
      severity: emailsFailed > 0 ? 'medium' : 'low',
      tags: ['email', 'daily-summary', 'commitment-status', 'automated']
    });

  } catch (error) {
    console.error('❌ Error in daily commitment status summary process:', error);
    
    // Log the error
    await logSystemAction('daily_commitment_status_summary_failed', 'system', {
      message: `Daily commitment status summary process failed: ${error.message}`,
      error: {
        message: error.message,
        stack: error.stack
      },
      severity: 'critical',
      tags: ['email', 'daily-summary', 'system-error']
    });
  }
};

/**
 * Get statistics for today's status changes
 */
const getTodayStatusChangeStats = async () => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const stats = await CommitmentStatusChange.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: '$newStatus',
          count: { $sum: 1 },
          totalValue: { $sum: '$commitmentDetails.totalPrice' }
        }
      }
    ]);

    const processedStats = await CommitmentStatusChange.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd },
          processedForEmail: true
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      totalChanges: stats.reduce((sum, stat) => sum + stat.count, 0),
      approvedChanges: stats.find(stat => stat._id === 'approved')?.count || 0,
      declinedChanges: stats.find(stat => stat._id === 'declined')?.count || 0,
      totalApprovedValue: stats.find(stat => stat._id === 'approved')?.totalValue || 0,
      totalDeclinedValue: stats.find(stat => stat._id === 'declined')?.totalValue || 0,
      processedChanges: processedStats[0]?.count || 0
    };
  } catch (error) {
    console.error('Error getting today\'s status change stats:', error);
    return null;
  }
};

module.exports = {
  sendDailyCommitmentStatusSummaries,
  getTodayStatusChangeStats
};
