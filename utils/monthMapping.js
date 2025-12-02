/**
 * Month Mapping Utility for Backend
 * Used for scheduler and email notifications only
 * DO NOT use in routes - routes should use simple month filtering
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Get the previous month for a given month/year
 */
const getPreviousMonth = (monthName, year) => {
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex === 0) {
    return { month: 'December', year: year - 1 };
  }
  return { month: MONTHS[monthIndex - 1], year };
};

/**
 * Get the next month for a given month/year
 */
const getNextMonth = (monthName, year) => {
  const monthIndex = MONTHS.indexOf(monthName);
  if (monthIndex === 11) {
    return { month: 'January', year: year + 1 };
  }
  return { month: MONTHS[monthIndex + 1], year };
};

/**
 * Get month index from month name
 */
const getMonthIndex = (monthName) => {
  return MONTHS.indexOf(monthName);
};

/**
 * Create New Mexico timezone date
 */
const createNewMexicoDate = (year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) => {
  return new Date(year, month, day, hour, minute, second, millisecond);
};

/**
 * Format date as YYYY-MM-DD
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get commitment dates for a given month/year
 */
const getCommitmentDates = (monthName, year) => {
  const monthIndex = getMonthIndex(monthName);
  let commitmentStart, commitmentEnd;

  if (monthName === 'July' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 5, 29, 0, 0, 0, 0); // Jun 29, 2025
    commitmentEnd = createNewMexicoDate(2025, 6, 10, 23, 59, 59, 999); // Jul 10, 2025
  } else if (monthName === 'August' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 7, 1, 0, 0, 0, 0); // Aug 1, 2025
    commitmentEnd = createNewMexicoDate(2025, 7, 12, 23, 59, 59, 999); // Aug 12, 2025
  } else if (monthName === 'September' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 8, 1, 0, 0, 0, 0); // Sep 1, 2025
    commitmentEnd = createNewMexicoDate(2025, 8, 10, 23, 59, 59, 999); // Sep 10, 2025
  } else if (monthName === 'October' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 9, 1, 0, 0, 0, 0); // Oct 1, 2025
    commitmentEnd = createNewMexicoDate(2025, 9, 11, 23, 59, 59, 999); // Oct 11, 2025
  } else if (monthName === 'November' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 10, 1, 0, 0, 0, 0); // Nov 1, 2025
    commitmentEnd = createNewMexicoDate(2025, 10, 10, 23, 59, 59, 999); // Nov 10, 2025
  } else if (monthName === 'December' && year === 2025) {
    commitmentStart = createNewMexicoDate(2025, 11, 2, 0, 0, 0, 0); // Dec 2, 2025
    commitmentEnd = createNewMexicoDate(2025, 11, 12, 23, 59, 59, 999); // Dec 12, 2025
  } else if (monthName === 'January' && year === 2026) {
    commitmentStart = createNewMexicoDate(2025, 11, 29, 0, 0, 0, 0); // Dec 29, 2025
    commitmentEnd = createNewMexicoDate(2026, 0, 9, 23, 59, 59, 999); // Jan 9, 2026
  } else if (monthName === 'February' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 1, 2, 0, 0, 0, 0); // Feb 2, 2026
    commitmentEnd = createNewMexicoDate(2026, 1, 12, 23, 59, 59, 999); // Feb 12, 2026
  } else if (monthName === 'March' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 2, 2, 0, 0, 0, 0); // Mar 2, 2026
    commitmentEnd = createNewMexicoDate(2026, 2, 12, 23, 59, 59, 999); // Mar 12, 2026
  } else if (monthName === 'April' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 3, 1, 0, 0, 0, 0); // Apr 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 3, 10, 23, 59, 59, 999); // Apr 10, 2026
  } else if (monthName === 'May' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 3, 30, 0, 0, 0, 0); // Apr 30, 2026
    commitmentEnd = createNewMexicoDate(2026, 4, 11, 23, 59, 59, 999); // May 11, 2026
  } else if (monthName === 'June' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 5, 1, 0, 0, 0, 0); // Jun 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 5, 11, 23, 59, 59, 999); // Jun 11, 2026
  } else if (monthName === 'July' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 5, 29, 0, 0, 0, 0); // Jun 29, 2026
    commitmentEnd = createNewMexicoDate(2026, 6, 10, 23, 59, 59, 999); // Jul 10, 2026
  } else if (monthName === 'August' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 7, 1, 0, 0, 0, 0); // Aug 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 7, 12, 23, 59, 59, 999); // Aug 12, 2026
  } else if (monthName === 'September' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 8, 1, 0, 0, 0, 0); // Sep 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 8, 10, 23, 59, 59, 999); // Sep 10, 2026
  } else if (monthName === 'October' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 9, 1, 0, 0, 0, 0); // Oct 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 9, 11, 23, 59, 59, 999); // Oct 11, 2026
  } else if (monthName === 'November' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 10, 1, 0, 0, 0, 0); // Nov 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 10, 10, 23, 59, 59, 999); // Nov 10, 2026
  } else if (monthName === 'December' && year === 2026) {
    commitmentStart = createNewMexicoDate(2026, 11, 1, 0, 0, 0, 0); // Dec 1, 2026
    commitmentEnd = createNewMexicoDate(2026, 11, 10, 23, 59, 59, 999); // Dec 10, 2026
  } else {
    // Default: commitment period is first 10 days of the month
    commitmentStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0);
    commitmentEnd = createNewMexicoDate(year, monthIndex, 10, 23, 59, 59, 999);
  }

  return {
    commitmentStart: formatDate(commitmentStart),
    commitmentEnd: formatDate(commitmentEnd),
    commitmentStartDate: commitmentStart,
    commitmentEndDate: commitmentEnd
  };
};

/**
 * Get deal timeframe (start and end of the month)
 */
const getDealTimeframe = (monthName, year) => {
  const monthIndex = getMonthIndex(monthName);
  const timeframeStart = createNewMexicoDate(year, monthIndex, 1, 0, 0, 0, 0);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
  const timeframeEnd = createNewMexicoDate(year, monthIndex, lastDayOfMonth, 23, 59, 59, 999);

  return {
    timeframeStart: formatDate(timeframeStart),
    timeframeEnd: formatDate(timeframeEnd),
    timeframeStartDate: timeframeStart,
    timeframeEndDate: timeframeEnd
  };
};

/**
 * Get deadline (3 days before the month starts)
 */
const getDeadline = (monthName, year) => {
  const monthIndex = getMonthIndex(monthName);
  const monthStart = createNewMexicoDate(year, monthIndex, 1);
  const deadline = new Date(monthStart);
  deadline.setDate(deadline.getDate() - 3);

  return formatDate(deadline);
};

/**
 * Generate the monthly deal schedule table
 * Used for scheduler and email notifications
 */
const generateDealMonthsTable = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const table = [];

  for (let year = currentYear; year <= currentYear + 1; year++) {
    MONTHS.forEach((month, monthIndex) => {
      if (year === currentYear && monthIndex < currentMonth) {
        return;
      }

      const deadline = getDeadline(month, year);
      const timeframe = getDealTimeframe(month, year);
      const commitment = getCommitmentDates(month, year);

      table.push({
        month,
        year,
        deadline,
        timeframeStart: timeframe.timeframeStart,
        timeframeEnd: timeframe.timeframeEnd,
        commitmentStart: commitment.commitmentStart,
        commitmentEnd: commitment.commitmentEnd
      });
    });
  }

  return table;
};

module.exports = {
  getPreviousMonth,
  getNextMonth,
  getMonthIndex,
  getCommitmentDates,
  getDealTimeframe,
  getDeadline,
  generateDealMonthsTable,
  MONTHS
};

