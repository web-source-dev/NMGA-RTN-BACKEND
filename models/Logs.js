const mongoose = require('mongoose');

// Define the schema for logs
const logSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'success', 'error', 'warning'],
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
}, {
    timestamps: true,
});

// Create the model from the schema
module.exports = mongoose.model('Log', logSchema);
