const DealMessages = {
    // New deal creation notification
    newDeal: (dealInfo) => {
        return `New Deal Alert! "${dealInfo.dealName}" by ${dealInfo.distributorName}\nPrice: $${dealInfo.price}\nExpires: ${new Date(dealInfo.expiryDate).toLocaleDateString()}`;
    },

    // Deal expiration notification
    dealExpiration: (dealDetails) => {
        if (dealDetails.status === 'expired') {
            return `Deal "${dealDetails.title}" has expired and is no longer active.`;
        }
        return `Deal Alert: "${dealDetails.title}" is expiring in ${dealDetails.timeRemaining}. Expires on ${new Date(dealDetails.expiryDate).toLocaleDateString()}.`;
    },

    // Deal status update
    dealStatusUpdate: (dealName, status) => {
        return `Deal Status Update: "${dealName}" is now ${status}.`;
    },

    // Commitment notification
    newCommitment: (dealName, quantity, totalPrice) => {
        return `New commitment received for "${dealName}". Quantity: ${quantity}, Total: $${totalPrice}`;
    },

    // Commitment status update
    commitmentStatusUpdate: (dealName, status, modifiedDetails = null) => {
        let message = `Your commitment for "${dealName}" has been ${status}`;
        if (modifiedDetails) {
            message += `\nModified Quantity: ${modifiedDetails.quantity}`;
            message += `\nModified Price: $${modifiedDetails.price}`;
        }
        return message;
    },

    // Order confirmation
    orderConfirmation: (orderDetails) => {
        return `Order Confirmed! Deal: "${orderDetails.dealName}"\nQuantity: ${orderDetails.quantity}\nTotal: $${orderDetails.totalPrice}`;
    },

    // Bulk upload notification
    bulkUploadSuccess: (count) => {
        return `Successfully uploaded ${count} deals to the platform.`;
    }
};

module.exports = DealMessages; 