const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: 'system'
    },
    isShowOnPage: {
        type: Boolean,
        default: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    lastModifiedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
featureSchema.index({ name: 1 });

module.exports = mongoose.model('Feature', featureSchema);
