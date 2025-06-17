const Deal = require('../models/Deals');
const User = require('../models/User');
const Commitment = require('../models/Commitments');
const sendEmail = require('./email');
const Log = require('../models/Logs');
const { sendDealMessage } = require('./message');
const DealsBatchExpirationTemplate = require('./EmailTemplates/DealsBatchExpirationTemplate');
const mongoose = require('mongoose');

const { FRONTEND_URL } = process.env;


const checkDealExpiration = async () => {
  try {
    // Verify database connection first

    console.log(FRONTEND_URL)
    console.log('running expiration check')
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

    // Get members with timeout handling - ensure we're only getting members, not distributors or admins
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

    // Process notifications for each interval
    for (const interval of notificationIntervals) {
      const futureDate = new Date();
      futureDate.setDate(currentDate.getDate() + interval.days);
      
      // For the 1-hour notification, we need more precise timing
      if (interval.days < 1) {
        futureDate.setHours(currentDate.getHours() + 1);
      }

      // Find deals that are about to expire within this interval
      // Populate distributor and commitments but don't use lean() to preserve Map functionality
      const dealsToNotify = await Deal.find({
        dealEndsAt: {
          $gt: currentDate,
          $lte: futureDate
        },
        status: 'active'
      })
      .populate('distributor')
      .populate('commitments');
      if (dealsToNotify.length === 0) continue;

      const notificationKey = `notification_${interval.days}`;
      
      // Group deals by users who need to be notified
      const userDealsMap = new Map();
      
      // Build a map of user IDs to the deals they should be notified about
      for (const deal of dealsToNotify) {
        const notifiedUsers = deal.notificationHistory && deal.notificationHistory.get ? 
          deal.notificationHistory.get(notificationKey) || [] : 
          [];
        
        const notifiedUserIds = notifiedUsers.map(n => n.userId.toString());
        
        // Find users who haven't been notified about this deal yet
        members.forEach(user => {
          if (!notifiedUserIds.includes(user._id.toString())) {
            if (!userDealsMap.has(user._id.toString())) {
              userDealsMap.set(user._id.toString(), { user, deals: [] });
            }
            userDealsMap.get(user._id.toString()).deals.push(deal);
          }
        });
      }

      // Send batch notifications to each user
      for (const [userId, { user, deals }] of userDealsMap.entries()) {
        if (deals.length === 0) continue;

        try {
          const timeRemaining = interval.label;
          
          // Send batch email notification
          await sendEmail(
            user.email,
            `${deals.length} Deal${deals.length > 1 ? 's' : ''} Ending in ${timeRemaining}!`,
            DealsBatchExpirationTemplate(user.name, deals, timeRemaining)
          );

          // Record successful notifications for each deal
          for (const deal of deals) {
            // No need to get the deal again as we didn't use lean()
            if (!deal.notificationHistory.has(notificationKey)) {
              deal.notificationHistory.set(notificationKey, []);
            }
            
            deal.notificationHistory.get(notificationKey).push({
              userId: user._id,
              sentAt: new Date()
            });
            
            // Save each deal's updated notification history
            await deal.save();
          }

          // Send SMS if phone number exists (still sending individual SMS for better readability)
          if (user.phone) {
            // Send up to 3 SMS messages at most to avoid overwhelming the user
            const dealsToSendSMS = deals.slice(0, 3);
            for (const deal of dealsToSendSMS) {
              const dealInfo = {
                title: deal.name,
                expiryDate: deal.dealEndsAt,
                timeRemaining: interval.label,
                distributorName: deal.distributor ? deal.distributor.name : 'Unknown Distributor',
                currentPrice: deal.coopPrice,
                status: deal.status
              };
              
              try {
                await sendDealMessage.dealExpiration(user.phone, dealInfo);
              } catch (error) {
                console.error(`Failed to send expiration notice to ${user.name}:`, error);
                // Log SMS failure but continue execution
                await Log.create({
                  message: `Failed to send SMS ${interval.label} notification to ${user.name} for deal "${deal.name}"`,
                  type: 'warning',
                  user_id: user._id
                }).catch(err => console.error('Log creation failed:', err));
              }
            }
            
            // If there are more deals than what we sent SMS for, add a note about it
            if (deals.length > 3) {
              try {
                await sendDealMessage.genericMessage(user.phone, 
                  `And ${deals.length - 3} more deal${deals.length - 3 > 1 ? 's' : ''} ending in ${timeRemaining}. Check your email for details.`
                );
              } catch (error) {
                console.error(`Failed to send additional deals count SMS to ${user.name}:`, error);
              }
            }
          }

          await Log.create({
            message: `${timeRemaining} expiration batch notification sent to ${user.name} for ${deals.length} deal(s)`,
            type: 'info',
            user_id: user._id
          });

        } catch (error) {
          await Log.create({
            message: `Failed to send ${interval.label} batch expiration notification to ${user.email} for ${deals.length} deal(s)`,
            type: 'error',
            user_id: user._id
          });
          console.error('Batch notification error:', error);
        }
      }
    }

    // Handle expired deals
    const expiredDeals = await Deal.find({
      dealEndsAt: { $lt: currentDate },
      status: 'active'
    })
    .populate('distributor')
    .populate('commitments');

    if (expiredDeals.length > 0) {
      // Group expired deals by users who need to be notified
      const expiredUserDealsMap = new Map();
      
      for (const deal of expiredDeals) {
        // Update deal status
        deal.status = 'inactive';
        await deal.save();
        
        // Log the deal deactivation
        await Log.create({
          message: `Deal "${deal.name}" automatically deactivated due to expiration`,
          type: 'info',
          user_id: deal.distributor ? deal.distributor._id : null
        });
        
        const notifiedUsers = deal.notificationHistory && deal.notificationHistory.get ? 
          deal.notificationHistory.get('notification_expired') || [] : 
          [];
          
        const notifiedUserIds = notifiedUsers.map(n => n.userId.toString());
        
        members.forEach(user => {
          if (!notifiedUserIds.includes(user._id.toString())) {
            if (!expiredUserDealsMap.has(user._id.toString())) {
              expiredUserDealsMap.set(user._id.toString(), { user, deals: [] });
            }
            expiredUserDealsMap.get(user._id.toString()).deals.push(deal);
          }
        });
      }

      // Send batch notifications for expired deals
      for (const [userId, { user, deals }] of expiredUserDealsMap.entries()) {
        if (deals.length === 0) continue;

        try {
          // Send batch email notification for expired deals
          await sendEmail(
            user.email,
            `${deals.length} Deal${deals.length > 1 ? 's have' : ' has'} Expired`,
            DealsBatchExpirationTemplate(user.name, deals, 'expired')
          );

          // Send SMS notification (limited to first 3 deals)
          if (user.phone) {
            const dealsToSendSMS = deals.slice(0, 3);
            for (const deal of dealsToSendSMS) {
              try {
                await sendDealMessage.dealExpiration(user.phone, {
                  title: deal.name,
                  expiryDate: deal.dealEndsAt,
                  status: 'expired'
                });
              } catch (smsError) {
                console.error(`Failed to send SMS notification to ${user.name}:`, smsError);
                await Log.create({
                  message: `Failed to send SMS expiration notification to ${user.name} for deal "${deal.name}"`,
                  type: 'warning',
                  user_id: user._id
                }).catch(err => console.error('Log creation failed:', err));
              }
            }
            
            // Additional message if there are more than 3 expired deals
            if (deals.length > 3) {
              try {
                await sendDealMessage.genericMessage(user.phone, 
                  `And ${deals.length - 3} more deal${deals.length - 3 > 1 ? 's have' : ' has'} expired. Check your email for details.`
                );
              } catch (error) {
                console.error(`Failed to send additional expired deals count SMS to ${user.name}:`, error);
              }
            }
          }

          // Record the notifications for each deal
          for (const deal of deals) {
            if (!deal.notificationHistory.has('notification_expired')) {
              deal.notificationHistory.set('notification_expired', []);
            }
            
            deal.notificationHistory.get('notification_expired').push({
              userId: user._id,
              sentAt: new Date()
            });
            
            await deal.save();
          }

          await Log.create({
            message: `Expiration batch notification sent to ${user.name} for ${deals.length} deal(s)`,
            type: 'info',
            user_id: user._id
          });

        } catch (error) {
          console.error('Error sending expiration batch notification:', error);
          await Log.create({
            message: `Failed to send expiration batch notification to ${user.email} for ${deals.length} deal(s)`,
            type: 'error',
            user_id: user._id
          });
        }
      }
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