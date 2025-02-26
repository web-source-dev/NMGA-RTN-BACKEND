const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

const PaymentNotificationTemplate = {
    success: {
        member: (name, dealName, amount, paymentMethod, transactionId) => baseTemplate(`
            <h2>Payment Successful</h2>
            <p>Dear ${name},</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="color: #155724; margin: 0;">
                    <strong>Your payment has been successfully processed!</strong>
                </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>Payment Details:</h3>
                <ul>
                    <li>Deal: ${dealName}</li>
                    <li>Amount: $${amount.toLocaleString()}</li>
                    <li>Payment Method: ${paymentMethod}</li>
                    <li>Transaction ID: ${transactionId}</li>
                </ul>
            </div>

            <p>You can view your payment details and track your order in your dashboard.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
            </div>
        `),

        distributor: (memberName, dealName, amount, paymentMethod, transactionId) => baseTemplate(`
            <h2>Payment Received</h2>
            <p>Hello,</p>

            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="color: #155724; margin: 0;">
                    <strong>A payment has been successfully received!</strong>
                </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>Payment Details:</h3>
                <ul>
                    <li>Member: ${memberName}</li>
                    <li>Deal: ${dealName}</li>
                    <li>Amount: $${amount.toLocaleString()}</li>
                    <li>Payment Method: ${paymentMethod}</li>
                    <li>Transaction ID: ${transactionId}</li>
                </ul>
            </div>

            <p>You can process this order through your dashboard.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
            </div>
        `)
    },

    failed: {
        member: (name, dealName, amount, error) => baseTemplate(`
            <h2>Payment Failed</h2>
            <p>Dear ${name},</p>

            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="color: #721c24; margin: 0;">
                    <strong>Your payment could not be processed.</strong>
                </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>Payment Details:</h3>
                <ul>
                    <li>Deal: ${dealName}</li>
                    <li>Amount: $${amount.toLocaleString()}</li>
                    <li>Error: ${error}</li>
                </ul>
            </div>

            <p>Please try again or use a different payment method.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${FRONTEND_URL}/checkout" class="button">Retry Payment</a>
            </div>
        `)
    }
};

module.exports = PaymentNotificationTemplate; 