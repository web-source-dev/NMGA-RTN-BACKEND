const Deal = require('../models/Deals');
const User = require('../models/User');
const sendEmail = require('./email');
const Log = require('../models/Logs');
const { sendDealMessage } = require('./message');
const DealExpirationTemplate = require('./EmailTemplates/DealExpirationTemplate');
const mongoose = require('mongoose');

const checkDealExpiration = async () => {
  try {
    // Verify database connection first
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected. Skipping deal expiration check.');
      return;
    }

    const currentDate = new Date();
    
    // Define notification intervals (in days)
    const notificationIntervals = [
      { days: 5, label: '5 days' },
      { days: 3, label: '3 days' },
      { days: 1, label: '1 day' },
      { days: 0.042, label: '1 hour' } // 1 hour = 1/24 days ≈ 0.042 days
    ];

    // Get members with timeout handling
    const members = await Promise.race([
      User.find({ 
        role: 'member',
        isBlocked: false
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )
    ]);

    if (!members) {
      throw new Error('Failed to fetch members');
    }

    for (const interval of notificationIntervals) {
      const futureDate = new Date();
      futureDate.setDate(currentDate.getDate() + interval.days);
      
      // For the 1-hour notification, we need more precise timing
      if (interval.days < 1) {
        futureDate.setHours(currentDate.getHours() + 1);
      }

      // Find deals that are about to expire within this interval
      const dealsToNotify = await Deal.find({
        dealEndsAt: {
          $gt: currentDate,
          $lte: futureDate
        },
        status: 'active'
      }).populate('distributor');

      // Send notifications for deals ending soon
      for (const deal of dealsToNotify) {
        const notificationKey = `notification_${interval.days}`;
        
        // Get users who haven't been notified for this interval
        const notifiedUsers = deal.notificationHistory.get(notificationKey) || [];
        const notifiedUserIds = notifiedUsers.map(n => n.userId.toString());
        
        // Filter out members who have already been notified
        const usersToNotify = members.filter(user => 
          !notifiedUserIds.includes(user._id.toString())
        );

        // Send notifications only to members
        for (const member of usersToNotify) {
          try {
            const timeRemaining = interval.label;
            
            // Send email notification
            await sendEmail(
              member.email,
              `Deal Ending in ${timeRemaining}!`,
              DealExpirationTemplate(member.name, deal.name, deal.dealEndsAt, timeRemaining)
            );

            // Send SMS if phone number exists
            if (member.phone) {
              const dealInfo = {
                title: deal.name,
                expiryDate: deal.dealEndsAt,
                timeRemaining: interval.label,
                distributorName: deal.distributor ? deal.distributor.name : 'Unknown Distributor',
                currentPrice: deal.coopPrice,
                status: deal.status
              };
              
              try {
                await sendDealMessage.dealExpiration(member.phone, dealInfo);
              } catch (error) {
                console.error(`Failed to send expiration notice to ${member.name}:`, error);
                // Log SMS failure but continue execution
                await Log.create({
                  message: `Failed to send SMS ${interval.label} notification to ${member.name} for deal "${deal.name}"`,
                  type: 'warning',
                  user_id: member._id
                }).catch(err => console.error('Log creation failed:', err));
              }
            }

            // Record successful notification
            if (!deal.notificationHistory.has(notificationKey)) {
              deal.notificationHistory.set(notificationKey, []);
            }
            deal.notificationHistory.get(notificationKey).push({
              userId: member._id,
              sentAt: new Date()
            });

            await Log.create({
              message: `${timeRemaining} expiration notification sent to member ${member.name} for deal "${deal.name}"`,
              type: 'info',
              user_id: member._id
            });

          } catch (error) {
            await Log.create({
              message: `Failed to send ${interval.label} expiration notification to member ${member.email} for deal ${deal.name}`,
              type: 'error',
              user_id: member._id
            });
            console.error('Notification error:', error);
          }
        }

        // Save the updated notification history
        await deal.save();
      }
    }

    // Handle expired deals
    const expiredDeals = await Deal.find({
      dealEndsAt: { $lt: currentDate },
      status: 'active'
    }).populate('distributor');

    for (const deal of expiredDeals) {
      deal.status = 'inactive';
      
      // Send expiration notifications only to members
      const notifiedUsers = deal.notificationHistory.get('notification_expired') || [];
      const notifiedUserIds = notifiedUsers.map(n => n.userId.toString());
      
      const membersToNotify = members.filter(user => 
        !notifiedUserIds.includes(user._id.toString())
      );

      for (const member of membersToNotify) {
        try {
          // Send email notification
          await sendEmail(
            member.email,
            'Deal Has Expired',
            DealExpirationTemplate(member.name, deal.name, deal.dealEndsAt, 'expired')
          );

          // Send SMS notification
          if (member.phone) {
            try {
              await sendDealMessage.dealExpiration(member.phone, {
                title: deal.name,
                expiryDate: deal.dealEndsAt,
                status: 'expired'
              });
            } catch (smsError) {
              console.error(`Failed to send SMS notification to ${member.name}:`, smsError);
              // Log SMS failure but continue execution
              await Log.create({
                message: `Failed to send SMS expiration notification to ${member.name} for deal "${deal.name}"`,
                type: 'warning',
                user_id: member._id
              }).catch(err => console.error('Log creation failed:', err));
            }
          }

          // Record the notification
          if (!deal.notificationHistory.has('notification_expired')) {
            deal.notificationHistory.set('notification_expired', []);
          }
          deal.notificationHistory.get('notification_expired').push({
            userId: member._id,
            sentAt: new Date()
          });

          await Log.create({
            message: `Expiration notification sent to member ${member.name} for deal "${deal.name}"`,
            type: 'info',
            user_id: member._id
          });

        } catch (error) {
          console.error('Error sending expiration notification:', error);
          await Log.create({
            message: `Failed to send expiration notification to member ${member.email} for deal "${deal.name}"`,
            type: 'error',
            user_id: member._id
          });
        }
      }
      
      await deal.save();
      
      // Log the deal deactivation
      await Log.create({
        message: `Deal "${deal.name}" automatically deactivated due to expiration`,
        type: 'info',
        user_id: deal.distributor ? deal.distributor._id : null
      });
    }

  } catch (error) {
    console.error('Error in deal expiration check:', error);
    // Only try to create log if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Log.create({
          message: `Error in deal expiration check: ${error.message}`,
          type: 'error'
        });
      } catch (logError) {
        console.error('Failed to create error log:', logError);
      }
    }
  }
};

module.exports = checkDealExpiration; 