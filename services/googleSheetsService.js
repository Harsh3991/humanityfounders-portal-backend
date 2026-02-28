const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const path = require("path");
const fs = require("fs");

/**
 * Initialize Google Sheets API Client
 * 
 * Supports two modes:
 * 1. (Primary)  GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY env vars
 * 2. (Fallback) GOOGLE_APPLICATION_CREDENTIALS env var pointing to JSON key file
 */
const getAuthClient = () => {
    try {
        // Mode 1: Use individual env vars (works on Heroku, local, everywhere)
        if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            // Handle private key newlines: dotenv with single quotes keeps literal \n,
            // Heroku also keeps literal \n — this replace converts them to real newlines.
            // If already real newlines (dotenv double quotes), the replace is a no-op.
            const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

            return new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: privateKey,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });
        }

        // Mode 2: Fallback to JSON key file
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (credentialsPath) {
            const resolvedPath = path.resolve(credentialsPath);
            if (fs.existsSync(resolvedPath)) {
                const keyFile = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
                return new JWT({
                    email: keyFile.client_email,
                    key: keyFile.private_key,
                    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
                });
            } else {
                console.error("GOOGLE_APPLICATION_CREDENTIALS file not found at:", resolvedPath);
            }
        }

        console.error("Missing Google Service Account credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY env vars.");
        return null;
    } catch (error) {
        console.error("Error creating Google Auth Client:", error);
        return null;
    }
};

/**
 * Get the Google Sheets API instance
 */
const getSheetsInstance = () => {
    const authClient = getAuthClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!authClient || !spreadsheetId) {
        return null;
    }

    return {
        sheets: google.sheets({ version: "v4", auth: authClient }),
        spreadsheetId,
    };
};

/**
 * Format seconds into HH:MM:SS
 */
const formatHHMMSS = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Helper: get date/time components in IST (Asia/Kolkata) regardless of server timezone.
 * Returns { year, month (1-12), day, hours (0-23), minutes, seconds }
 */
const getISTComponents = (dateObj) => {
    const d = new Date(dateObj);
    // Use Intl to extract individual parts in IST
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value || '00';
    return {
        year: parseInt(get('year')),
        month: parseInt(get('month')),
        day: parseInt(get('day')),
        hours: parseInt(get('hour')),
        minutes: parseInt(get('minute')),
        seconds: parseInt(get('second')),
    };
};

/**
 * Format a Date into HH:MM:SS (24hr) in IST. If the date is on a different calendar day
 * than recordDate (in IST), append "(DD-MM-YYYY)" to flag cross-day.
 */
const formatTimeWithCrossDay = (dateObj, recordDate) => {
    if (!dateObj) return "-";
    const c = getISTComponents(dateObj);
    const timeStr = `${String(c.hours).padStart(2, '0')}:${String(c.minutes).padStart(2, '0')}:${String(c.seconds).padStart(2, '0')}`;

    // Check if this timestamp is on a different calendar day than the record's date (in IST)
    if (recordDate) {
        const rc = getISTComponents(recordDate);
        if (
            c.year !== rc.year ||
            c.month !== rc.month ||
            c.day !== rc.day
        ) {
            const dayStr = `${String(c.day).padStart(2, '0')}-${String(c.month).padStart(2, '0')}-${c.year}`;
            return `${timeStr} (${dayStr})`;
        }
    }
    return timeStr;
};

/**
 * Format the date as DD-MM-YYYY in IST
 */
const formatDateDDMMYYYY = (dateObj) => {
    if (!dateObj) return "";
    const c = getISTComponents(dateObj);
    return `${String(c.day).padStart(2, '0')}-${String(c.month).padStart(2, '0')}-${c.year}`;
};

/**
 * Build the full row data for a given attendance record.
 *
 * Columns:
 *   A: Employee Name
 *   B: Date (DD-MM-YYYY)
 *   C: Status
 *   D: Working Hours (HH:MM:SS)
 *   E+: Dynamic session columns — 1st Clock In, 1st Clock Out, 1st Report, 2nd Clock In, 2nd Clock Out, 2nd Report, ...
 *        plus any currently active (not yet closed) session
 */
const buildSheetRow = (userName, record) => {
    const dateStr = formatDateDDMMYYYY(record.date);
    const status = record.status || "absent";
    const workedSeconds = record.activeSeconds || 0;
    const hoursStr = formatHHMMSS(workedSeconds);

    const row = [userName, dateStr, status, hoursStr];

    // Split the dailyReport into individual reports (one per clock-out)
    // Format: "[time]: report text" separated by newlines
    const reports = (record.dailyReport || "")
        .split("\n")
        .filter(r => r.trim() !== "")
        .map(r => r.replace(/^\[.*?\]:\s*/, ""));  // Strip "[time]: " prefix

    // Add completed sessions from the sessions array
    const sessions = record.sessions || [];
    for (let i = 0; i < sessions.length; i++) {
        row.push(formatTimeWithCrossDay(sessions[i].start, record.date));
        row.push(formatTimeWithCrossDay(sessions[i].end, record.date));
        // Add the report for this session (if it exists)
        row.push(reports[i] || "");
    }

    // If currently clocked-in (active session not yet in sessions array),
    // add the current clock-in time without a clock-out yet
    if (record.status === "clocked-in" && record.lastActiveAt) {
        row.push(formatTimeWithCrossDay(record.lastActiveAt, record.date));
        // No clock-out or report yet for this active session
    }

    return row;
};

/**
 * Build the header row. Fixed columns + dynamic session columns.
 * Each session has 3 columns: Clock In, Clock Out, Report
 */
const buildHeaderRow = (sessionCount) => {
    const header = ["Employee Name", "Date", "Status", "Working Hours"];
    for (let i = 1; i <= sessionCount; i++) {
        const label = getOrdinal(i);
        header.push(`${label} Clock In`);
        header.push(`${label} Clock Out`);
        header.push(`${label} Report`);
    }
    return header;
};

/**
 * Get ordinal label: 1 -> "1st", 2 -> "2nd", 3 -> "3rd", etc.
 */
const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Ensure that row 1 of the sheet has proper headers.
 * If the current data row has more sessions than existing headers,
 * expand the headers.
 */
const ensureHeaders = async (sheets, spreadsheetId, dataRowLength) => {
    try {
        // Read row 1
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!1:1",
        });

        const existingHeader = (headerResponse.data.values && headerResponse.data.values[0]) || [];

        // Calculate how many session groups the data row has
        // Data row: [Name, Date, Status, Hours, ...sessions]
        // Each session group = 3 columns (Clock In + Clock Out + Report)
        const sessionColumns = dataRowLength - 4; // subtract fixed columns
        const sessionCount = Math.ceil(sessionColumns / 3);

        // Check if existing header covers enough columns
        const neededColumns = 4 + (sessionCount * 3);

        if (existingHeader.length < neededColumns || existingHeader[0] !== "Employee Name") {
            // Build and write the header
            const header = buildHeaderRow(sessionCount);
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Sheet1!A1`,
                valueInputOption: "USER_ENTERED",
                resource: { values: [header] },
            });
        }
    } catch (error) {
        console.error("Error ensuring headers:", error.message);
        // Non-critical, don't throw
    }
};

/**
 * Sync (upsert) a single attendance record row to Google Sheet.
 * - Ensures row 1 has proper headers
 * - Finds existing row by Employee Name (col A) + Date (col B)
 * - If found: clears that row and writes the new data
 * - If not found: appends a new row
 */
const syncRecordToSheet = async (userName, record) => {
    const instance = getSheetsInstance();
    if (!instance) {
        console.error("Google Sheets not configured, skipping sync.");
        return;
    }

    const { sheets, spreadsheetId } = instance;
    const newRow = buildSheetRow(userName, record);
    const dateStr = newRow[1]; // DD-MM-YYYY

    try {
        // Ensure headers exist and are wide enough
        await ensureHeaders(sheets, spreadsheetId, newRow.length);

        // Read existing data to find matching row (skip row 1 = header)
        const readResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: "Sheet1!A:B",
        });

        const existingRows = readResponse.data.values || [];

        // Find the row index for this user + date combo (skip row 0 which is header)
        let rowIndex = -1;
        for (let i = existingRows.length - 1; i >= 1; i--) {
            if (existingRows[i][0] === userName && existingRows[i][1] === dateStr) {
                rowIndex = i + 1; // Google Sheets is 1-indexed
                break;
            }
        }

        if (rowIndex !== -1) {
            // CLEAR the old row first (to handle dynamic width shrinking)
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: `Sheet1!A${rowIndex}:Z${rowIndex}`,
            });

            // UPDATE with new data
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `Sheet1!A${rowIndex}`,
                valueInputOption: "RAW",
                resource: { values: [newRow] },
            });
        } else {
            // APPEND new row
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: "Sheet1!A:A",
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                resource: { values: [newRow] },
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Error syncing to Google Sheet:", error.message);
        throw error;
    }
};

module.exports = {
    syncRecordToSheet,
    buildSheetRow,
    formatHHMMSS,
};
