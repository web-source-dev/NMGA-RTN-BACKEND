# NMGA Reminder System Documentation

## Overview

The NMGA Reminder System is a comprehensive automated notification system that keeps distributors and members informed about important deadlines and opportunities in the deal commitment process. The system operates on a **monthly schedule basis** using cron jobs and sends both email and SMS notifications.

## System Architecture

### Core Components

1. **Scheduler** (`utils/scheduler.js`) - Manages all automated tasks
2. **Monthly Schedule** (`utils/monthlySchedule.js`) - Central schedule logic matching CreateDeal.jsx
3. **Distributor Reminders** (`utils/distributorReminders.js`) - Handles distributor notifications
4. **Member Reminders** (`utils/memberCommitmentReminders.js`) - Handles member notifications
5. **Email Templates** - Professional HTML email templates with monthly context
6. **SMS Templates** - Concise mobile-friendly messages with monthly context
7. **Database Tracking** - Prevents duplicate notifications per month

### Scheduling

All reminders run on **New Mexico Mountain Time** (America/Denver timezone):

- **Daily at 9:00 AM**: Distributor reminder checks
- **Daily at 10:00 AM**: Member reminder checks  
- **Every minute**: Member 1-hour closing warnings (for testing)
- **Daily at 5:00 PM**: Daily commitment summaries

### Monthly Schedule Logic

The system uses a **centralized monthly schedule** that replicates the exact logic from `CreateDeal.jsx`:

- **Posting Deadline**: 3 days before each month starts
- **Commitment Window**: Specific dates for each month (varies by month)
- **Deal Period**: Full month duration
- **All dates are in New Mexico Mountain Time**

---

## Distributor Reminder System

### 1. Monthly Deal Posting Deadline Reminders

**Purpose**: Remind ALL distributors to post their deals for the upcoming month before the monthly posting deadline.

**When Sent**:
- 5 days before the monthly posting deadline
- 3 days before the monthly posting deadline  
- 1 day before the monthly posting deadline

**How It Works**:
1. **Checks the monthly schedule** to determine if today is 5, 3, or 1 days before the posting deadline
2. **Gets the next month's schedule** (e.g., if it's December 2024, checks January 2025 deadline)
3. **Sends reminders to ALL distributors** regardless of whether they have deals or not
4. **Prevents duplicates** by checking if the distributor was already notified for that month

**Trigger Conditions**:
- Today is 5, 3, or 1 days before the monthly posting deadline
- Distributor hasn't been notified for this specific month yet
- Distributor is active and not blocked

**Email Content**:
```html
Subject: Deal Posting Reminder - [X] Days Remaining for [Month] [Year]

Dear [Distributor Name],

⏰ Important: You have [X] days remaining to post your deals for [Month] [Year]!

This is a friendly reminder that you have [X] days remaining to post your deals for [Month] [Year]. The posting deadline is approaching, and members will be able to make commitments starting on the commitment start date.

[Month] [Year] Deal Schedule:
📅 Posting Deadline: [Deadline Date]
📅 Commitment Window: [Start Date] - [End Date]
📅 Deal Period: [Start Date] - End of [Month] [Year]

📋 Action Required:
• Create and post your deals for [Month] [Year]
• Review and finalize your deal details
• Ensure all pricing and discount tiers are correct
• Upload any necessary product images
• Set your deals to "Active" status before the deadline

⚠️ Important: All deals must be posted and active before the commitment window opens. Members will not be able to make commitments for deals that are not posted in time.

[Go to Dashboard Button]

Best regards,
The NMGA Team
```

**SMS Content**:
```
NMGA Reminder: You have [X] day(s) to post your deals for [Month] [Year]. Deadline: [Deadline Date]. Please log in to create and post your deals.
```

### 2. Deal Approval Reminders

**Purpose**: Remind distributors to approve commitments after the commitment window closes.

**When Sent**:
- 5 days after commitment window closes

**How It Works**:
1. **Checks for deals** where the commitment window ended 5 days ago
2. **Finds deals with commitments** from members
3. **Sends reminders to distributors** who have deals awaiting approval
4. **Groups deals by distributor** to send consolidated reminders

**Trigger Conditions**:
- Deal's `commitmentEndsAt` was 5 days ago
- Deal has commitments from members
- Deal is still 'active' (not yet processed)
- Approval reminder hasn't been sent yet

**Email Content**:
```html
Subject: Deal Approval Reminder - Commitments Awaiting Review

Dear [Distributor Name],

📋 Action Required: The commitment window has closed and you have deals waiting for your approval!

The commitment window for your deals has closed, and members have made their commitments. It's now time to review and approve these commitments to finalize the deals.

Deals Awaiting Approval:
- Deal Name: [Deal Name]
- Category: [Category]
- Commitment Window: [Start Date] - [End Date]
- Total Commitments: [X] members
- Total Quantity: [X] units
- Status: Pending Approval

📋 Next Steps:
• Review all commitments for each deal
• Approve or decline individual commitments as needed
• Modify quantities or pricing if necessary
• Activate approved deals to make them available for purchase

[Review Commitments Button]

Important: Prompt approval helps ensure smooth order processing and member satisfaction.

Best regards,
The NMGA Team
```

**SMS Content**:
```
NMGA Reminder: You have [X] deal(s) with [Y] commitment(s) waiting for approval. Please log in to review and approve them.
```

---

## Member Reminder System

### 1. Monthly Commitment Window Opening Reminder

**Purpose**: Notify ALL members that the commitment window for the current month is opening tomorrow.

**When Sent**:
- 1 day before the monthly commitment window opens

**How It Works**:
1. **Checks the current month's schedule** to see if the commitment window opens tomorrow
2. **Sends reminders to ALL members** regardless of their commitment status
3. **Prevents duplicates** by checking if the member was already notified for this month
4. **Includes month and year context** in all communications

**Trigger Conditions**:
- Today is 1 day before the current month's commitment window opens
- Member hasn't been notified for this specific month yet
- Member is active and not blocked

**Email Content**:
```html
Subject: Commitment Window Opening Tomorrow - [Month] [Year]

Dear [Member Name],

📅 Important: The commitment window for [Month] [Year] deals will open tomorrow!

This is a friendly reminder that the commitment window for [Month] [Year] deals will open tomorrow. You'll have the opportunity to make commitments for exclusive member pricing on various products.

[Month] [Year] Commitment Window Schedule:
📅 Opens: [Start Date] at [Start Time]
📅 Closes: [End Date] at [End Time]
⏰ Duration: [X] days

✅ What to Expect:
• Access to exclusive member pricing for [Month] [Year]
• Bulk discount opportunities
• Limited-time offers
• Priority access to popular items

⏰ Important: The commitment window has a limited duration. Make sure to review and commit to deals before the window closes!

[View Available Deals Button]

Best regards,
The NMGA Team
```

**SMS Content**:
```
NMGA Alert: [Month] [Year] commitment window opens tomorrow ([Start Date]) and closes [End Date]. Don't miss out on member-exclusive pricing! Log in to make your commitments.
```

### 2. Monthly Commitment Window Closing Reminders

**Purpose**: Remind ALL members that the commitment window for the current month is closing soon.

**When Sent**:
- 5 days before the monthly commitment window closes
- 3 days before the monthly commitment window closes
- 1 day before the monthly commitment window closes
- 1 hour before the monthly commitment window closes

**How It Works**:
1. **Checks the current month's schedule** to see if the commitment window closes in 5, 3, 1 days, or 1 hour
2. **Sends reminders to ALL members** regardless of their commitment status
3. **Checks member's commitment status** for this month to personalize the message
4. **Prevents duplicates** by checking if the member was already notified for this specific reminder
5. **Includes month and year context** in all communications

**Trigger Conditions**:
- Today is 5, 3, 1 days, or 1 hour before the current month's commitment window closes
- Member hasn't been notified for this specific reminder type for this month yet
- Member is active and not blocked

**Email Content**:
```html
Subject: Commitment Window Closing in [Time] - [Month] [Year]

Dear [Member Name],

⏰ Important: The commitment window for [Month] [Year] will close in [time]!

This is a reminder that the commitment window for [Month] [Year] deals will close in [time]. After the window closes, you won't be able to make new commitments until the next month's window opens.

[Month] [Year] Commitment Window Status:
📅 Closes: [End Date] at [End Time]
⏰ Time Remaining: [Time]
📋 Your Status: [✅ You have made commitments / ⚠️ No commitments yet]

[If no commitments:]
⚠️ Action Required:
• You haven't made any commitments for [Month] [Year] yet
• Review available deals and pricing
• Make your commitments before the window closes
• Don't miss out on exclusive member pricing

[If has commitments:]
✅ Great Job!
• You've already made commitments for [Month] [Year]
• Review your commitments if needed
• Make additional commitments if desired
• Your orders will be processed after the window closes

[Make Commitments Now / Review My Commitments Button]

Note: After the commitment window closes, distributors will review and approve commitments before finalizing orders.

Best regards,
The NMGA Team
```

**SMS Content**:
```
NMGA Reminder: [Month] [Year] commitment window closes in [time] ([End Date]). [You have commitments / You have no commitments yet]. Log in now to secure your orders!
```

---

## Monthly Schedule System

### Overview

The reminder system now operates on a **monthly schedule basis** instead of individual deal tracking. This ensures consistent timing and prevents confusion about deadlines.

### Monthly Schedule Logic (`utils/monthlySchedule.js`)

The system replicates the exact schedule logic from `CreateDeal.jsx`:

#### **Schedule Generation**
- **Generates a complete table** of all months with their specific deadlines and commitment periods
- **Handles special cases** for specific months (July 2025, August 2025, etc.)
- **Uses New Mexico Mountain Time** for all date calculations
- **Covers current year and next year** to handle year transitions

#### **Key Functions**
1. **`generateDealMonthsTable()`** - Creates the complete monthly schedule
2. **`shouldSendPostingReminders()`** - Checks if posting reminders should be sent today
3. **`shouldSendCommitmentWindowOpeningReminders()`** - Checks if opening reminders should be sent today
4. **`shouldSendCommitmentWindowClosingReminders()`** - Checks if closing reminders should be sent today
5. **`getCurrentMonthSchedule()`** - Gets the current month's schedule
6. **`getNextMonthSchedule()`** - Gets the next month's schedule

#### **Monthly Schedule Example**
```javascript
{
  month: "January",
  year: 2025,
  deadline: "2024-12-29",           // 3 days before month starts
  timeframeStart: "2025-01-01",     // Deal period start
  timeframeEnd: "2025-01-31",       // Deal period end
  commitmentStart: "2024-12-29",    // Commitment window start
  commitmentEnd: "2025-01-09"       // Commitment window end
}
```

#### **Special Month Handling**
The system handles specific months with custom commitment periods:
- **July 2025**: June 29 - July 10
- **August 2025**: August 1 - August 12
- **September 2025**: September 1 - September 10
- **October 2025**: October 1 - October 11
- **November 2025**: November 1 - November 10
- **December 2025**: December 1 - December 10
- **January 2026**: December 29, 2025 - January 9, 2026
- And more...

#### **Default Schedule**
For months not specifically defined, the system uses:
- **Commitment Period**: First 10 days of the month
- **Posting Deadline**: 3 days before the month starts

### Benefits of Monthly Schedule System

1. **Consistency**: All reminders are based on the same monthly schedule
2. **Simplicity**: No need to track individual deal dates
3. **Accuracy**: Uses the exact same logic as the CreateDeal component
4. **Scalability**: Works regardless of how many deals are created
5. **Maintainability**: Single source of truth for all scheduling logic

---

## Commitment Notification System

### When Commitments Are Approved/Declined

**Purpose**: Notify members when their commitments are approved or declined by distributors.

**Trigger**: When distributor updates commitment status via bulk actions or individual updates.

**Email Content**:
```html
Subject: Your Commitment for [Deal Name] has been [Approved/Declined]

Dear [Member Name],

Your commitment for the deal [Deal Name] has been updated.

Commitment Details:
• Deal: [Deal Name]
• Size Details: [Size breakdown if applicable]
• Total Price: $[Amount]
• Status: [Approved/Declined] by the distributor

[If Approved:]
Your commitment has been approved by the distributor. You will be contacted with further instructions regarding payment and delivery.

[If Declined:]
Unfortunately, your commitment has been declined by the distributor. Please check your dashboard for more information or contact the distributor directly if you have any questions.

[View Your Commitments Button]

Best regards,
The NMGA Team
```

---

## Database Tracking

### Log-Based Tracking (New System)

The new monthly-based system uses the `Logs` collection for tracking instead of the Deal model:

```javascript
// Log entry for distributor posting reminders
{
  message: "5-day posting reminder sent to ABC Distribution Co. for January 2025",
  type: "info",
  user_id: ObjectId("distributor_id"),
  createdAt: Date
}

// Log entry for member opening reminders
{
  message: "Commitment window opening reminder sent to Member Store 1 for January 2025",
  type: "info", 
  user_id: ObjectId("member_id"),
  createdAt: Date
}

// Log entry for member closing reminders
{
  message: "3 days commitment window closing reminder sent to Member Store 1 for January 2025 (has commitments)",
  type: "info",
  user_id: ObjectId("member_id"),
  createdAt: Date
}
```

### Duplicate Prevention (Monthly-Based)

The system prevents duplicate notifications by:
1. **Checking Log entries** for existing reminders for the specific month and user
2. **Using regex patterns** to match reminder messages with month/year context
3. **Tracking per month** instead of per deal
4. **Unique keys** based on reminder type, month, year, and user

### Deal Model (Legacy - Still Present)

The `Deal` model still includes the original tracking structure for backward compatibility:

```javascript
// Distributor reminder tracking (legacy)
distributorReminders: {
  postingReminders: {
    type: Map,
    of: [{
      reminderType: { type: String, enum: ['5_days', '3_days', '1_day'] },
      sentAt: { type: Date }
    }],
    default: new Map()
  },
  approvalReminders: {
    type: Map,
    of: [{
      reminderType: { type: String, enum: ['5_days_after_commitment'] },
      sentAt: { type: Date }
    }],
    default: new Map()
  }
},

// Member reminder tracking (legacy)
memberReminders: {
  windowOpeningReminders: {
    type: Map,
    of: [{
      reminderType: { type: String, enum: ['1_day_before_opening'] },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date }
    }],
    default: new Map()
  },
  windowClosingReminders: {
    type: Map,
    of: [{
      reminderType: { type: String, enum: ['5_days_before_closing', '3_days_before_closing', '1_day_before_closing', '1_hour_before_closing'] },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date }
    }],
    default: new Map()
  }
}
```

### Benefits of Log-Based Tracking

1. **Simpler Queries**: Easy to search for existing reminders using regex patterns
2. **Better Audit Trail**: Complete history of all reminder activities
3. **Monthly Context**: Each log entry includes the specific month and year
4. **User-Specific**: Each log entry is tied to a specific user
5. **Searchable**: Easy to find and analyze reminder patterns

---

## Feature Toggles

The system includes feature toggles that can be enabled/disabled via the admin panel:

### DISTRIBUTOR_REMINDERS
- **Description**: Automatically sends email and SMS reminders to distributors for deal posting deadlines and deal approval reminders
- **When Enabled**: All distributor reminders are sent
- **When Disabled**: No distributor reminder notifications are sent

### MEMBER_REMINDERS  
- **Description**: Automatically sends email and SMS reminders to members for commitment window opening and closing
- **When Enabled**: All member reminders are sent
- **When Disabled**: No member reminder notifications are sent

---

## Error Handling & Logging

### Comprehensive Logging
- All reminder activities are logged in the `Logs` collection
- Success and failure notifications are tracked
- Error details are captured for debugging

### Error Recovery
- Database connection checks before processing
- Graceful handling of email/SMS failures
- Continues processing other users even if one fails

### Monitoring
- Console logs for all reminder activities
- Success/failure counts for each reminder type
- Detailed error messages for troubleshooting

---

## Email Design Features

### Professional Styling
- NMGA branded header with logo
- Responsive design for mobile and desktop
- Color-coded urgency levels (info, warning, danger)
- Clear call-to-action buttons

### Content Structure
- Clear subject lines indicating urgency
- Scannable content with bullet points
- Relevant deal information when applicable
- Direct links to dashboard actions

### Accessibility
- High contrast colors
- Clear typography
- Alt text for images
- Semantic HTML structure

---

## SMS Design Features

### Concise Messaging
- Character-optimized for mobile delivery
- Key information only
- Clear action items
- Branded with "NMGA" prefix

### Urgency Indicators
- Different messaging based on time remaining
- Status indicators (has commitments vs. no commitments)
- Clear next steps

---

## System Integration

### Real-time Updates
- Integrates with Socket.IO for live notifications
- Broadcasts deal updates to connected clients
- Updates dashboard in real-time

### Email Service
- Uses Brevo (formerly Sendinblue) for email delivery
- Supports HTML templates
- Handles additional email addresses from user profiles

### SMS Service
- Uses Twilio for SMS delivery
- International phone number support
- Delivery status tracking

---

## Testing & Maintenance

### Testing the Monthly Schedule System

#### **Test Monthly Schedule Logic**
```bash
cd NMGA-RTN-BACKEND
node scripts/testMonthlySchedule.js
```

This will show you:
- Complete monthly schedule table
- Current month's schedule
- Next month's schedule
- Whether reminders should be sent today
- All specific dates and deadlines

#### **Test Reminder Functions**
```bash
# Test distributor posting reminders
node scripts/testReminders.js posting

# Test member opening reminders  
node scripts/testReminders.js opening

# Test member closing reminders
node scripts/testReminders.js closing

# Test all reminders
node scripts/testReminders.js all
```

#### **Manual Testing**
- Feature toggles allow easy testing
- Console logs provide detailed feedback
- Log entries show sent reminders with monthly context
- Monthly schedule can be verified against CreateDeal.jsx

### Maintenance

#### **Regular Tasks**
- Monitor reminder delivery through Log entries
- Verify monthly schedule accuracy
- Check timezone handling for DST changes
- Update templates as needed

#### **Monthly Schedule Updates**
- The schedule logic is centralized in `utils/monthlySchedule.js`
- Updates to CreateDeal.jsx should be reflected in the monthly schedule
- Special month handling can be added as needed

#### **Troubleshooting**
- Check Log entries for reminder delivery status
- Verify monthly schedule calculations
- Test with different dates to ensure accuracy
- Monitor console logs for detailed feedback

---

## Future Enhancements

### Potential Improvements
1. **Customizable Reminder Preferences**: Allow users to choose which reminders they receive
2. **Advanced Scheduling**: More granular control over reminder timing
3. **Analytics Dashboard**: Track reminder effectiveness and engagement
4. **Multi-language Support**: Templates in multiple languages
5. **Push Notifications**: Browser and mobile app notifications
6. **Reminder History**: User dashboard showing all received reminders

### Scalability Considerations
- Batch processing for large user bases
- Queue system for high-volume notifications
- Caching for frequently accessed data
- Database optimization for reminder tracking

---

## Summary

This comprehensive **monthly-based reminder system** ensures that all stakeholders in the NMGA platform stay informed about important deadlines and opportunities. The system now operates on a **centralized monthly schedule** that:

### **Key Features**
- **Monthly Schedule-Based**: All reminders are based on the same monthly schedule as CreateDeal.jsx
- **Universal Notifications**: Sends reminders to ALL distributors and members, not just those with specific deals
- **Consistent Timing**: Uses the exact same deadline and commitment window dates for everyone
- **Month/Year Context**: All communications include the specific month and year being referenced
- **Duplicate Prevention**: Prevents sending the same reminder multiple times to the same user for the same month
- **Comprehensive Logging**: Tracks all reminder activities with detailed monthly context

### **Benefits**
1. **Simplified Management**: No need to track individual deal dates
2. **Consistent Experience**: All users receive reminders at the same time
3. **Accurate Scheduling**: Uses the exact same logic as the deal creation system
4. **Better Engagement**: Ensures no one misses important deadlines
5. **Scalable**: Works regardless of how many deals are created
6. **Maintainable**: Single source of truth for all scheduling logic

### **System Flow**
1. **Daily at 9:00 AM**: Check if distributor posting reminders should be sent
2. **Daily at 10:00 AM**: Check if member commitment reminders should be sent
3. **Every minute**: Check if 1-hour closing warnings should be sent
4. **All times**: Use monthly schedule to determine exact timing
5. **All reminders**: Include month/year context and prevent duplicates

This monthly-based approach ensures that all stakeholders in the NMGA platform stay informed about important deadlines and opportunities, leading to better engagement and more successful deal commitments.
