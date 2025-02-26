const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: ''
  },
  subheading: {
    type: String,
    trim: true,
    default: ''
  },
  content: {
    type: String,
    trim: true,
    default: ''
  },
  media: {
    type: [{
      type: {
        type: String,
        enum: ['image', 'video'],
        default: 'image'
      },
      url: {
        type: String,
        required: true,
        trim: true
      }
    }],
    default: []
  },
  ctaButtons: {
    type: [{
      text: {
        type: String,
        default: 'Click Here'
      },
      link: {
        type: String,
        default: '#'
      },
      analytics: {
        clicks: {
          type: Number,
          default: 0
        },
        uniqueClicks: {
          type: Number,
          default: 0
        },
        lastClicked: Date,
        clickHistory: [{
          timestamp: Date,
          userId: String,
          deviceInfo: String
        }]
      }
    }],
    default: []
  }
});

const splashPageSchema = new mongoose.Schema({
  cards: {
    type: [cardSchema],
  },
  displaySettings: {
    displayType: {
      type: String,
      enum: ['modal', 'fullscreen', 'banner', 'corner', 'center-strip'],
      default: 'modal'
    },
    animation: {
      type: String,
      enum: ['fade', 'slide', 'zoom', 'bounce', 'none'],
      default: 'fade'
    },
    navigationStyle: {
      type: String,
      enum: ['slider', 'buttons', 'dots', 'thumbnails', 'none'],
      default: 'slider'
    },
      autoPlay: {
        type: Boolean,
        default: false
      },
    },
  scheduling: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    showOnlyOnce: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['once', 'daily', 'weekly', 'monthly'],
      default: 'once'
    },
    daysOfWeek: {
      type: [{
        type: Number,
        min: 0,
        max: 6
      }],
      default: []
    },
    timeOfDay: {
      start: {
        type: String,
        default: '00:00'
      },
      end: {
        type: String,
        default: '23:59'
      }
    }
  },
  targeting: {
    userRoles: {
      type: [{
        type: String,
        enum: ['member', 'distributor', 'admin', 'all']
      }],
      default: ['all']
    }
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    uniqueViews: {
      type: Number,
      default: 0
    },
    closeRate: {
      type: Number,
      default: 0
    },
    totalCloses: {
      type: Number,
      default: 0
    },
    lastViewed: Date,
    viewHistory: [{
      timestamp: Date,
      userId: String,
      deviceInfo: String
    }],
    closeHistory: [{
      timestamp: Date,
      userId: String,
      timeSpent: Number
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SplashPage', splashPageSchema);
