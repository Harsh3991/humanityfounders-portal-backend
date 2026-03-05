
/**
 * Date Utility for consistent IST (Asia/Kolkata) date handling
 * Ensures that 00:00:00 IST is always represented by the same UTC timestamp
 * regardless of whether the server is running locally (IST) or in production (UTC).
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // +5:30

/**
 * Gets the start and end of the day in IST for a given date.
 * Returns Date objects that can be used directly for MongoDB queries.
 */
exports.getTodayRangeIST = (date = new Date()) => {
    // 1. Get current time in UTC
    const utcTime = date.getTime();

    // 2. Adjust to IST to find out what day it "looks like" in India
    const istDate = new Date(utcTime + IST_OFFSET);

    const y = istDate.getUTCFullYear();
    const m = istDate.getUTCMonth();
    const d = istDate.getUTCDate();

    // 3. Normalize to 00:00:00 IST. 
    // This moment is always the same UTC timestamp: T18:30:00.000Z of (day - 1)
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET);
    const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET);

    return { start, end };
};

/**
 * Gets the start and end of the month in IST.
 */
exports.getMonthRangeIST = (month, year) => {
    // month is 1-12
    const now = new Date();
    const targetMonth = month || (new Date(now.getTime() + IST_OFFSET).getUTCMonth() + 1);
    const targetYear = year || new Date(now.getTime() + IST_OFFSET).getUTCFullYear();

    const start = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0) - IST_OFFSET);
    const end = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999) - IST_OFFSET);

    return { start, end };
};
