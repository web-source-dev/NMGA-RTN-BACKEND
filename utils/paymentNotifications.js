const sendEmail = require('./email');
const PaymentNotificationTemplate = require('./EmailTemplates/PaymentNotificationTemplate');

const sendPaymentNotifications = async (commitment, paymentDetails) => {
    try {
        // Send email to member
        await sendEmail(
            commitment.userId.email,
            'Payment Successful',
            PaymentNotificationTemplate.success.member(
                commitment.userId.name,
                commitment.dealId.name,
                paymentDetails.amount,
                paymentDetails.method,
                paymentDetails.transactionId
            )
        );

        // Send email to distributor
        await sendEmail(
            commitment.dealId.distributor.email,
            'Payment Received',
            PaymentNotificationTemplate.success.distributor(
                commitment.userId.name,
                commitment.dealId.name,
                paymentDetails.amount,
                paymentDetails.method,
                paymentDetails.transactionId
            )
        );

        return true;
    } catch (error) {
        console.error('Error sending payment notifications:', error);
        return false;
    }
};

module.exports = { sendPaymentNotifications }; 