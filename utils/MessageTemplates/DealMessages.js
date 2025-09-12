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
    },

    // Distributor posting deadline reminder
    distributorPostingReminder: (daysRemaining, dealNames, month, year, deadline) => {
        if (dealNames && dealNames.length > 0) {
            // Individual deal reminder (legacy)
            const dealList = dealNames.length > 3 ? 
                `${dealNames.slice(0, 3).join(', ')} and ${dealNames.length - 3} more` : 
                dealNames.join(', ');
            
            return `NMGA Reminder: You have ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} to post your deals before the commitment window opens. Deals: ${dealList}. Please log in to your dashboard to post them.`;
        } else {
            // Monthly reminder
            const deadlineDate = new Date(deadline).toLocaleDateString();
            return `NMGA Reminder: You have ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} to post your deals for ${month} ${year}. Deadline: ${deadlineDate}. Please log in to create and post your deals.`;
        }
    },

    // Distributor approval reminder
    distributorApprovalReminder: (dealCount, totalCommitments) => {
        return `NMGA Reminder: You have ${dealCount} deal${dealCount > 1 ? 's' : ''} with ${totalCommitments} commitment${totalCommitments > 1 ? 's' : ''} waiting for approval. Please log in to review and approve them.`;
    },

    // Member commitment window opening reminder
    memberCommitmentWindowOpening: (commitmentStartDate, commitmentEndDate, month, year) => {
        const startDate = new Date(commitmentStartDate);
        const endDate = new Date(commitmentEndDate);
        return `NMGA Alert: ${month} ${year} commitment window opens tomorrow (${startDate.toLocaleDateString()}) and closes ${endDate.toLocaleDateString()}. Don't miss out on member-exclusive pricing! Log in to make your commitments.`;
    },

    // Member commitment window closing reminder
    memberCommitmentWindowClosing: (timeRemaining, commitmentEndDate, hasCommitments, month, year) => {
        const endDate = new Date(commitmentEndDate);
        const commitmentStatus = hasCommitments ? 'You have commitments' : 'You have no commitments yet';
        return `NMGA Reminder: ${month} ${year} commitment window closes in ${timeRemaining} (${endDate.toLocaleDateString()}). ${commitmentStatus}. Log in now to secure your orders!`;
    }
};

module.exports = DealMessages; 