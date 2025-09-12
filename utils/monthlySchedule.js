/**
 * Monthly Deal Schedule Utility
 * Replicates the schedule logic from CreateDeal.jsx for backend use
 */

/**
 * Generate the monthly deal schedule table
 * This matches the logic from CreateDeal.jsx
 */
function generateDealMonthsTable() {
  // Get current date in New Mexico timezone (Mountain Time)
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const table = [];
  
  // Helper function to create New Mexico timezone dates
  const createNewMexicoDate = (year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) => {
    // Create the date in local timezone first
    const date = new Date(year, month, day, hour, minute, second, millisecond);
    return date;
  };
  
  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Generate for current year and next year
  for (let year = currentYear; year <= currentYear + 1; year++) {
    months.forEach((month, monthIndex) => {
      // Skip past months in current year
      if (year === currentYear && monthIndex < currentMonth) {
        return;
      }
      
      // Calculate deadline (3 days before the month starts) - New Mexico time
      const monthStart = createNewMexicoDate(year, monthIndex, 1);
      const deadline = new Date(monthStart);
      deadline.setDate(deadline.getDate() - 3); // 3 days before month starts
      
      // Deal timeframe is the complete month (1st to last day) - New Mexico time
      const timeframeStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0); // 1st day at 12:00 AM New Mexico time
      // Get the last day of the current month
      const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
      const timeframeEnd = createNewMexicoDate(year, monthIndex, lastDayOfMonth, 23, 59, 59, 999); // Last day at 11:59 PM New Mexico time
      
      // Commitment timeframe based on the provided table - New Mexico time
      let commitmentStart, commitmentEnd;
      
      if (month === 'July' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 5, 29, 0, 0, 0, 0); // Jun 29, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 6, 10, 23, 59, 59, 999); // Jul 10, 2025 at 11:59 PM New Mexico time
      } else if (month === 'August' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 7, 1, 0, 0, 0, 0); // Aug 1, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 7, 12, 23, 59, 59, 999); // Aug 12, 2025 at 11:59 PM New Mexico time
      } else if (month === 'September' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 8, 1, 0, 0, 0, 0); // Sep 1, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 8, 10, 23, 59, 59, 999); // Sep 10, 2025 at 11:59 PM New Mexico time
      } else if (month === 'October' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 9, 1, 0, 0, 0, 0); // Oct 1, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 9, 11, 23, 59, 59, 999); // Oct 11, 2025 at 11:59 PM New Mexico time
      } else if (month === 'November' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 10, 1, 0, 0, 0, 0); // Nov 1, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 10, 10, 23, 59, 59, 999); // Nov 10, 2025 at 11:59 PM New Mexico time
      } else if (month === 'December' && year === 2025) {
        commitmentStart = createNewMexicoDate(2025, 11, 1, 0, 0, 0, 0); // Dec 1, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2025, 11, 10, 23, 59, 59, 999); // Dec 10, 2025 at 11:59 PM New Mexico time
      } else if (month === 'January' && year === 2026) {
        commitmentStart = createNewMexicoDate(2025, 11, 29, 0, 0, 0, 0); // Dec 29, 2025 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 0, 9, 23, 59, 59, 999); // Jan 9, 2026 at 11:59 PM New Mexico time
      } else if (month === 'February' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 1, 2, 0, 0, 0, 0); // Feb 2, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 1, 12, 23, 59, 59, 999); // Feb 12, 2026 at 11:59 PM New Mexico time
      } else if (month === 'March' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 2, 2, 0, 0, 0, 0); // Mar 2, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 2, 12, 23, 59, 59, 999); // Mar 12, 2026 at 11:59 PM New Mexico time
      } else if (month === 'April' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 3, 1, 0, 0, 0, 0); // Apr 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 3, 10, 23, 59, 59, 999); // Apr 10, 2026 at 11:59 PM New Mexico time
      } else if (month === 'May' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 3, 30, 0, 0, 0, 0); // Apr 30, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 4, 11, 23, 59, 59, 999); // May 11, 2026 at 11:59 PM New Mexico time
      } else if (month === 'June' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 5, 1, 0, 0, 0, 0); // Jun 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 5, 11, 23, 59, 59, 999); // Jun 11, 2026 at 11:59 PM New Mexico time
      } else if (month === 'July' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 5, 29, 0, 0, 0, 0); // Jun 29, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 6, 10, 23, 59, 59, 999); // Jul 10, 2026 at 11:59 PM New Mexico time
      } else if (month === 'August' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 7, 1, 0, 0, 0, 0); // Aug 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 7, 12, 23, 59, 59, 999); // Aug 12, 2026 at 11:59 PM New Mexico time
      } else if (month === 'September' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 8, 1, 0, 0, 0, 0); // Sep 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 8, 10, 23, 59, 59, 999); // Sep 10, 2026 at 11:59 PM New Mexico time
      } else if (month === 'October' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 9, 1, 0, 0, 0, 0); // Oct 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 9, 11, 23, 59, 59, 999); // Oct 11, 2026 at 11:59 PM New Mexico time
      } else if (month === 'November' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 10, 1, 0, 0, 0, 0); // Nov 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 10, 10, 23, 59, 59, 999); // Nov 10, 2026 at 11:59 PM New Mexico time
      } else if (month === 'December' && year === 2026) {
        commitmentStart = createNewMexicoDate(2026, 11, 1, 0, 0, 0, 0); // Dec 1, 2026 at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(2026, 11, 10, 23, 59, 59, 999); // Dec 10, 2026 at 11:59 PM New Mexico time
      } else {
        // Default: commitment period is first 10 days of the month
        commitmentStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0); // 1st day at 12:00 AM New Mexico time
        commitmentEnd = createNewMexicoDate(year, monthIndex, 10, 23, 59, 59, 999); // 10th day at 11:59 PM New Mexico time
      }
      
      table.push({
        month,
        year,
        deadline: formatDate(deadline),
        timeframeStart: formatDate(timeframeStart),
        timeframeEnd: formatDate(timeframeEnd),
        commitmentStart: formatDate(commitmentStart),
        commitmentEnd: formatDate(commitmentEnd)
      });
    });
  }
  
  return table;
}

/**
 * Get the next month name for display (delivery month)
 */
function getNextMonthName(monthName, year) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentIndex = months.indexOf(monthName);
  const nextIndex = (currentIndex + 1) % 12;
  const nextYear = currentIndex === 11 ? year + 1 : year; // If December, next year
  return { month: months[nextIndex], year: nextYear };
}

/**
 * Get the current month's schedule information
 */
function getCurrentMonthSchedule() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthName = months[currentMonth];
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
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  let nextMonth = currentMonth + 1;
  let nextYear = currentYear;
  
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear = currentYear + 1;
  }
  
  const monthName = months[nextMonth];
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
