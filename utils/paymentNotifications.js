const sendEmail = require('./email');
const PaymentNotificationTemplate = require('./EmailTemplates/PaymentNotificationTemplate');

const sendPaymentNotifications = async (commitment, paymentDetails) => {
    try {
        // Payment email notifications disabled - using in-app notifications only
        // await sendEmail(
        //     commitment.userId.email,
        //     'Payment Successful',
        //     PaymentNotificationTemplate.success.member(
        //         commitment.userId.name,
        //         commitment.dealId.name,
        //         paymentDetails.amount,
        //         paymentDetails.method,
        //         paymentDetails.transactionId
        //     )
        // );

        // await sendEmail(
        //     commitment.dealId.distributor.email,
        //     'Payment Received',
        //     PaymentNotificationTemplate.success.distributor(
        //         commitment.userId.name,
        //         commitment.dealId.name,
        //         paymentDetails.amount,
        //         paymentDetails.method,
        //         paymentDetails.transactionId
        //     )
        // );

        console.log('Payment notifications disabled - using in-app notifications');
        return true;
    } catch (error) {
        console.error('Error in payment notifications handler:', error);
        return false;
    }
};

module.exports = { sendPaymentNotifications }; 