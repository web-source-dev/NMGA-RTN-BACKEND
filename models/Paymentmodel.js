const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    commitmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commitment',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dealId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'paypal'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        required: true,
        sparse: true
    },
    paymentDetails: {
        type: Object
    },
    refundStatus: {
        type: String,
        enum: ['none', 'requested', 'processing', 'completed', 'failed'],
        default: 'none'
    },
    billingDetails: {
        name: String,
        email: String,
        phone: String,
        address: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            postal_code: String,
            country: String
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
 