const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true
    },
    content: {
        type: String,
        
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    category: {
        type: String,
        enum: ['General', 'Event', 'Update'],
        default: 'General'
    },
    tags: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    event: {
        type: String,
        enum: [
            'login', 
            'signup', 
            'admin_dashboard', 
            'distributor_dashboard', 
            'procurement_dashboard',
            'deal_management',
            'user_management',
            'analytics',
            'profile',
            'orders',
            'suppliers',
            'splash_content',
            'announcements',
            'logs',
            'custom'
        ],
        required: true
    },
    startTime: {
        type: Date,
        
    },
    endTime: {
        type: Date,
        
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Announcement', announcementSchema);