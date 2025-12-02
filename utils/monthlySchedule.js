/**
 * Monthly Deal Schedule Utility
 * Uses the global monthMapping utility for scheduler and email notifications
 */

const { 
  generateDealMonthsTable: getDealMonthsTable,
  getNextMonth,
  MONTHS
} = require('./monthMapping');

/**
 * Generate the monthly deal schedule table
 * Uses the global utility for consistency
 */
function generateDealMonthsTable() {
  return getDealMonthsTable();
}

/**
 * Get the next month name for display (delivery month)
 * Uses the global monthMapping utility
 */
function getNextMonthName(monthName, year) {
  return getNextMonth(monthName, year);
}

/**
 * Get the current month's schedule information
 */
function getCurrentMonthSchedule() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const monthName = MONTHS[currentMonth];
  const table = generateDealMonthsTable();
  
  return table.find(row => row.month === monthName && row.year === currentYear);
}

/**
 * Get the next month's schedule information
 */
function getNextMonthSchedule() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear = currentYear + 1;
  }
  
  const monthName = MONTHS[nextMonth];
  const table = generateDealMonthsTable();
  
  return table.find(row => row.month === monthName && row.year === nextYear);
}

/**
 * Check if we should send posting deadline reminders for the next month
 */
function shouldSendPostingReminders() {
  const nextMonth = getNextMonthSchedule();
  if (!nextMonth) return null;
  
  // Get current date in New Mexico timezone
  const newMexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
  const currentDate = new Date(newMexicoTime);
  
  // Set deadline date to start of day in New Mexico timezone
  const deadlineDate = new Date(nextMonth.deadline + 'T00:00:00');
  
  // Calculate days until deadline (using date comparison, not time)
  const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const deadlineDateOnly = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
  
  const timeDiff = deadlineDateOnly.getTime() - currentDateOnly.getTime();
  const daysUntilDeadline = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  // Send reminders 5, 3, and 1 days before deadline
  if (daysUntilDeadline === 5 || daysUntilDeadline === 3 || daysUntilDeadline === 1) {
    return {
      nextMonth,
      daysUntilDeadline,
      reminderType: `${daysUntilDeadline}_days`
    };
  }
  
  return null;
}

/**
 * Check if we should send commitment window opening reminders
 */
function shouldSendCommitmentWindowOpeningReminders() {
  const currentMonth = getCurrentMonthSchedule();
  if (!currentMonth) return null;
  
  // Get current date in New Mexico timezone
  const newMexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
  const currentDate = new Date(newMexicoTime);
  
  // Set commitment start date to start of day in New Mexico timezone
  const commitmentStartDate = new Date(currentMonth.commitmentStart + 'T00:00:00');
  
  // Calculate days until commitment window opens (using date comparison, not time)
  const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const commitmentStartDateOnly = new Date(commitmentStartDate.getFullYear(), commitmentStartDate.getMonth(), commitmentStartDate.getDate());
  
  const timeDiff = commitmentStartDateOnly.getTime() - currentDateOnly.getTime();
  const daysUntilOpening = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  // Send reminder 1 day before commitment window opens
  if (daysUntilOpening === 1) {
    return {
      currentMonth,
      daysUntilOpening
    };
  }
  
  return null;
}

/**
 * Check if we should send commitment window closing reminders
 */
function shouldSendCommitmentWindowClosingReminders() {
  const currentMonth = getCurrentMonthSchedule();
  if (!currentMonth) return null;
  
  // Get current date in New Mexico timezone
  const newMexicoTime = new Date().toLocaleString("en-US", {timeZone: "America/Denver"});
  const currentDate = new Date(newMexicoTime);
  
  // Set commitment end date to end of day in New Mexico timezone
  const commitmentEndDate = new Date(currentMonth.commitmentEnd + 'T23:59:59');
  
  // Calculate days/hours until commitment window closes
  const timeDiff = commitmentEndDate.getTime() - currentDate.getTime();
  const daysUntilClosing = Math.ceil(timeDiff / (1000 * 3600 * 24));
  const hoursUntilClosing = Math.ceil(timeDiff / (1000 * 3600));
  
  // Send reminders 5, 3, 1 days, and 1 hour before closing
  if (daysUntilClosing === 5) {
    return { currentMonth, timeRemaining: '5 days', reminderType: '5_days_before_closing' };
  } else if (daysUntilClosing === 3) {
    return { currentMonth, timeRemaining: '3 days', reminderType: '3_days_before_closing' };
  } else if (daysUntilClosing === 1) {
    return { currentMonth, timeRemaining: '1 day', reminderType: '1_day_before_closing' };
  } else if (hoursUntilClosing === 1) {
    return { currentMonth, timeRemaining: '1 hour', reminderType: '1_hour_before_closing' };
  }
  
  return null;
}

module.exports = {
  generateDealMonthsTable,
  getNextMonthName,
  getCurrentMonthSchedule,
  getNextMonthSchedule,
  shouldSendPostingReminders,
  shouldSendCommitmentWindowOpeningReminders,
  shouldSendCommitmentWindowClosingReminders
};
