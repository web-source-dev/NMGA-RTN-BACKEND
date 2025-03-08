const mongoose = require('mongoose');

const dailyCommitmentSummarySchema = new mongoose.Schema({
    date: { 
        type: Date, 
        required: true 
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    distributorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    commitments: [{
        commitmentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Commitment" 
        },
        dealId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Deal" 
        },
        quantity: Number,
        totalPrice: Number,
        dealName: String,
        originalCost: Number,
        discountPrice: Number
    }],
    totalCommitments: { 
        type: Number, 
        default: 0 
    },
    totalQuantity: { 
        type: Number, 
        default: 0 
    },
    totalAmount: { 
        type: Number, 
        default: 0 
    },
    emailSent: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

// Create compound index for efficient querying
dailyCommitmentSummarySchema.index({ date: 1, userId: 1, distributorId: 1 });

module.exports = mongoose.model("DailyCommitmentSummary", dailyCommitmentSummarySchema); 