/**
 * Utility functions for real-time deal updates via Socket.IO
 */
const { isFeatureEnabled } = require('../config/features');

/**
 * Broadcasts a deal update to all connected clients
 * @param {Object} deal - The updated deal object
 * @param {String} updateType - The type of update (created, updated, deleted)
 */
const broadcastDealUpdate = async (deal, updateType) => {
  // Check if real-time updates feature is enabled
  if (!(await isFeatureEnabled('REALTIME_UPDATES'))) {
    console.log('🔄 Real-time updates feature is disabled. Deal update would have been broadcast:', {
      dealId: deal._id,
      updateType
    });
    return;
  }

  if (!global.io) {
    console.error('Socket.IO instance not available');
    return;
  }

  console.log(`Broadcasting deal ${updateType} for deal ID: ${deal._id}`);
  
  // Broadcast the update to all connected clients
  global.io.emit('deal-update', {
    type: updateType,
    deal: deal
  });
};

/**
 * Broadcasts a specific deal's details update
 * @param {String} dealId - The ID of the updated deal
 * @param {Object} dealData - The complete updated deal data
 */
const broadcastSingleDealUpdate = async (dealId, dealData) => {
  // Check if real-time updates feature is enabled
  if (!(await isFeatureEnabled('REALTIME_UPDATES'))) {
    console.log('🔄 Real-time updates feature is disabled. Single deal update would have been broadcast:', {
      dealId,
      dealDataKeys: Object.keys(dealData || {})
    });
    return;
  }

  if (!global.io) {
    console.error('Socket.IO instance not available');
    return;
  }

  console.log(`Broadcasting single deal update for deal ID: ${dealId}`);
  
  // Broadcast the update to all connected clients
  global.io.emit('single-deal-update', {
    dealId,
    dealData
  });
};

module.exports = {
  broadcastDealUpdate,
  broadcastSingleDealUpdate
}; 