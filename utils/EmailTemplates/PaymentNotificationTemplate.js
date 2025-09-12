const baseTemplate = require('./baseTemplate');
const { FRONTEND_URL } = process.env;

const PaymentNotificationTemplate = {
    success: {
        member: (name, dealName, amount, paymentMethod, transactionId) => baseTemplate(`
            <h2>Payment Successful</h2>
            <p>Dear ${name},</p>

            <div class="alert-box alert-success">
                <p style="margin: 0;">
                    <strong>Your payment has been successfully processed!</strong>
                </p>
            </div>

            <div class="card">
                <h3 class="card-header">Payment Details:</h3>
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

            <div class="alert-box alert-success">
                <p style="margin: 0;">
                    <strong>A payment has been successfully received!</strong>
                </p>
            </div>

            <div class="card">
                <h3 class="card-header">Payment Details:</h3>
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

            <div class="alert-box alert-danger">
                <p style="margin: 0;">
                    <strong>Your payment could not be processed.</strong>
                </p>
            </div>

            <div class="card">
                <h3 class="card-header">Payment Details:</h3>
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