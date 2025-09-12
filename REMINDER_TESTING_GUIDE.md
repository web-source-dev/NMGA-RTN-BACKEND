# Reminder System Testing Guide

## Overview

This guide explains how to test all aspects of the NMGA reminder system using the provided seed data and manual testing scripts.

## Prerequisites

1. **Database Connection**: Ensure your MongoDB connection is working
2. **Environment Variables**: Make sure all required environment variables are set
3. **Email/SMS Services**: Configure Brevo (email) and Twilio (SMS) for actual delivery testing

## Step 1: Seed Test Data

First, run the seed script to create all test scenarios:

```bash
cd NMGA-RTN-BACKEND
node scripts/seedReminderTestData.js
```

This will create:
- **2 Test Distributors** with phone numbers
- **3 Test Members** with phone numbers  
- **9 Test Deals** covering all reminder scenarios
- **Test Commitments** for various scenarios

## Step 2: Test Individual Reminder Types

### Test Distributor Posting Reminders

```bash
# Test all distributor reminders
node scripts/testReminders.js distributor

# Test only posting reminders
node scripts/testReminders.js posting
```

**Expected Results:**
- 3 emails sent to distributors (5-day, 3-day, 1-day reminders)
- 3 SMS messages sent (if phone numbers configured)
- Database tracking updated for each reminder

### Test Distributor Approval Reminders

```bash
# Test only approval reminders
node scripts/testReminders.js approval
```

**Expected Results:**
- 1 email sent to distributor about pending commitments
- 1 SMS message sent (if phone configured)
- Database tracking updated

### Test Member Window Opening Reminders

```bash
# Test only window opening reminders
node scripts/testReminders.js opening
```

**Expected Results:**
- 3 emails sent to members (one for each member)
- 3 SMS messages sent (if phone numbers configured)
- Database tracking updated

### Test Member Window Closing Reminders

```bash
# Test only window closing reminders
node scripts/testReminders.js closing
```

**Expected Results:**
- 9 emails sent to members (3 members × 3 closing reminders)
- 9 SMS messages sent (if phone numbers configured)
- Different messaging based on commitment status
- Database tracking updated

### Test All Reminders

```bash
# Test everything at once
node scripts/testReminders.js all
```

## Step 3: Test Commitment Notifications

### Manual Testing of Approval/Decline Notifications

1. **Find the notification test deal:**
   ```javascript
   // In MongoDB or via API
   const deal = await Deal.findOne({ name: 'TEST_COMMITMENT_NOTIFICATIONS' });
   ```

2. **Approve/Decline commitments via API:**
   ```bash
   # Approve all commitments
   POST /deals/bulk-approve-commitments
   {
     "dealId": "[DEAL_ID]"
   }
   
   # Or decline all commitments
   POST /deals/bulk-decline-commitments
   {
     "dealId": "[DEAL_ID]"
   }
   ```

3. **Check email delivery** for commitment status updates

## Step 4: Verify Results

### Check Database Tracking

```javascript
// Check distributor reminders
const deals = await Deal.find({ name: { $regex: /^TEST_/ } });
deals.forEach(deal => {
  console.log(`${deal.name}:`);
  console.log('  Posting reminders:', deal.distributorReminders?.postingReminders);
  console.log('  Approval reminders:', deal.distributorReminders?.approvalReminders);
  console.log('  Member opening reminders:', deal.memberReminders?.windowOpeningReminders);
  console.log('  Member closing reminders:', deal.memberReminders?.windowClosingReminders);
});
```

### Check Logs

```javascript
// Check system logs
const logs = await Log.find({ 
  message: { $regex: /reminder|commitment/i } 
}).sort({ createdAt: -1 }).limit(20);

logs.forEach(log => {
  console.log(`${log.createdAt}: ${log.message} (${log.type})`);
});
```

### Check Email/SMS Delivery

- **Email**: Check your email inbox for test emails
- **SMS**: Check your phone for test messages
- **Service Logs**: Check Brevo and Twilio dashboards for delivery status

## Step 5: Test Edge Cases

### Test with Feature Toggles Disabled

```javascript
// Disable features and test
await Feature.findOneAndUpdate(
  { name: 'DISTRIBUTOR_REMINDERS' },
  { enabled: false }
);

await Feature.findOneAndUpdate(
  { name: 'MEMBER_REMINDERS' },
  { enabled: false }
);

// Run reminders - should see "feature disabled" messages
node scripts/testReminders.js all
```

### Test Duplicate Prevention

```bash
# Run the same reminder twice
node scripts/testReminders.js posting
node scripts/testReminders.js posting

# Should only send reminders once
```

### Test with No Matching Data

```bash
# Clear test data and run reminders
# Should see "no deals found" messages
```

## Step 6: Test Cron Job Scheduling

### Manual Cron Testing

```bash
# Test the scheduler directly
node -e "
const { initializeScheduler } = require('./utils/scheduler');
initializeScheduler();
console.log('Scheduler initialized - cron jobs are now running');
"
```

### Time-based Testing

To test time-sensitive reminders:

1. **Modify dates in seed data** to match current time
2. **Run reminders** at specific times
3. **Verify** that only appropriate reminders are sent

## Test Data Scenarios

### Distributor Posting Reminders

| Deal Name | Commitment Start | Status | Expected Reminder |
|-----------|------------------|--------|-------------------|
| TEST_5_DAYS_POSTING_REMINDER | +5 days | inactive | 5-day reminder |
| TEST_3_DAYS_POSTING_REMINDER | +3 days | inactive | 3-day reminder |
| TEST_1_DAY_POSTING_REMINDER | +1 day | inactive | 1-day reminder |

### Distributor Approval Reminders

| Deal Name | Commitment End | Has Commitments | Expected Reminder |
|-----------|----------------|-----------------|-------------------|
| TEST_APPROVAL_REMINDER | -5 days | Yes (2 pending) | Approval reminder |

### Member Window Opening Reminders

| Deal Name | Commitment Start | Status | Expected Reminder |
|-----------|------------------|--------|-------------------|
| TEST_MEMBER_WINDOW_OPENING | +1 day | active | Opening reminder |

### Member Window Closing Reminders

| Deal Name | Commitment End | Expected Reminder |
|-----------|----------------|-------------------|
| TEST_MEMBER_5_DAYS_CLOSING | +5 days | 5-day closing |
| TEST_MEMBER_3_DAYS_CLOSING | +3 days | 3-day closing |
| TEST_MEMBER_1_DAY_CLOSING | +1 day | 1-day closing |
| TEST_MEMBER_1_HOUR_CLOSING | +1 hour | 1-hour closing |

### Member Commitment Status

| Member | Has Commitments | Expected Messaging |
|--------|-----------------|-------------------|
| Member 1 | Yes (2 deals) | "Review your commitments" |
| Member 2 | No | "Make commitments now" |
| Member 3 | No | "Make commitments now" |

## Troubleshooting

### Common Issues

1. **No reminders sent:**
   - Check feature toggles are enabled
   - Verify database connection
   - Check date calculations

2. **Duplicate reminders:**
   - Check database tracking
   - Verify reminder keys are unique

3. **Email/SMS not delivered:**
   - Check service configuration
   - Verify phone/email formats
   - Check service logs

4. **Wrong timing:**
   - Verify timezone settings
   - Check date calculations in seed data
   - Confirm cron job scheduling

### Debug Commands

```bash
# Check feature status
node -e "
const { getAllFeatures } = require('./config/features');
getAllFeatures().then(features => {
  console.log('DISTRIBUTOR_REMINDERS:', features.DISTRIBUTOR_REMINDERS?.enabled);
  console.log('MEMBER_REMINDERS:', features.MEMBER_REMINDERS?.enabled);
});
"

# Check test data
node -e "
const mongoose = require('mongoose');
const Deal = require('./models/Deals');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const deals = await Deal.find({ name: { $regex: /^TEST_/ } });
  console.log('Test deals found:', deals.length);
  deals.forEach(deal => {
    console.log(`${deal.name}: ${deal.commitmentStartAt} - ${deal.commitmentEndsAt}`);
  });
  process.exit(0);
});
"
```

## Cleanup

After testing, clean up test data:

```bash
node -e "
const mongoose = require('mongoose');
const Deal = require('./models/Deals');
const User = require('./models/User');
const Commitment = require('./models/Commitments');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await Deal.deleteMany({ name: { $regex: /^TEST_/ } });
  await User.deleteMany({ email: { $regex: /@test\.com$/ } });
  await Commitment.deleteMany({ dealId: { $exists: false } });
  console.log('Test data cleaned up');
  process.exit(0);
});
"
```

## Expected Email/SMS Counts

When running all tests, you should receive:

- **Emails**: 16 total
  - 3 distributor posting reminders
  - 1 distributor approval reminder
  - 3 member opening reminders
  - 9 member closing reminders

- **SMS**: 16 total (if phone numbers configured)
  - Same breakdown as emails

This comprehensive testing approach ensures all reminder scenarios work correctly and helps identify any issues before production deployment.
