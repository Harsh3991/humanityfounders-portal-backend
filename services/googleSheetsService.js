const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const path = require("path");
const fs = require("fs");

/**
 * Initialize Google Sheets API Client
 */
const getAuthClient = () => {
    try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
            return new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: privateKey,
                scopes: ["https://www.googleapis.com/auth/spreadsheets"],
            });
        }
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
            }
        }
        return null;
    } catch (error) {
        return null;
    }
};

const getSheetsInstance = () => {
    const authClient = getAuthClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!authClient || !spreadsheetId) return null;
    return { sheets: google.sheets({ version: "v4", auth: authClient }), spreadsheetId };
};

const formatHHMMSS = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getISTComponents = (dateObj) => {
    const d = new Date(dateObj);
    const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = FormatterToMap(formatter.formatToParts(d));
    return {
        year: parseInt(parts['year']), month: parseInt(parts['month']),
        day: parseInt(parts['day']), hours: parseInt(parts['hour']),
        minutes: parseInt(parts['minute']), seconds: parseInt(parts['second']),
    };
};
function FormatterToMap(parts) {
    let map = {};
    for (const part of parts) map[part.type] = part.value || '00';
    return map;
}

const getColumnLetter = (colIndex) => {
    let letter = "";
    while (colIndex >= 0) {
        letter = String.fromCharCode((colIndex % 26) + 65) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return letter;
};

const ensureMonthSheet = async (sheets, spreadsheetId, dateObj) => {
    const c = getISTComponents(dateObj);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const sheetTitle = `${monthNames[c.month - 1]} ${c.year}`;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetTitle);

    if (sheet) return sheetTitle;

    // Create sheet
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
    });

    const daysInMonth = new Date(c.year, c.month, 0).getDate();
    const headerRow = ["Employee Name", "Department"];
    for (let day = 1; day <= daysInMonth; day++) {
        headerRow.push(`${String(day).padStart(2, '0')}/${String(c.month).padStart(2, '0')}/${String(c.year).slice(-2)}`);
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'${sheetTitle}'!A1`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [headerRow] },
    });

    // Formatting: Highlight header row, blue background, white text for professional look
    const newSheetData = await sheets.spreadsheets.get({ spreadsheetId });
    const createdSheet = newSheetData.data.sheets.find(s => s.properties.title === sheetTitle);
    if (createdSheet) {
        const sheetId = createdSheet.properties.sheetId;
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.92, green: 0.96, blue: 1.0 }, // Light cyan-blue
                                    textFormat: { foregroundColor: { red: 0.2, green: 0.3, blue: 0.4 }, bold: true }, // Dark slate
                                    horizontalAlignment: "CENTER",
                                    verticalAlignment: "MIDDLE"
                                }
                            },
                            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                        }
                    },
                    {
                        repeatCell: {
                            range: { sheetId: sheetId, startRowIndex: 1 },
                            cell: {
                                userEnteredFormat: {
                                    wrapStrategy: "WRAP",
                                    verticalAlignment: "MIDDLE"
                                }
                            },
                            fields: "userEnteredFormat(wrapStrategy,verticalAlignment)"
                        }
                    },
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheetId,
                                gridProperties: {
                                    frozenRowCount: 1,
                                    frozenColumnCount: 2
                                }
                            },
                            fields: "gridProperties(frozenRowCount,frozenColumnCount)"
                        }
                    },
                    {
                        updateDimensionProperties: {
                            range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 2 },
                            properties: { pixelSize: 200 },
                            fields: "pixelSize"
                        }
                    }
                ]
            }
        });
    }

    return sheetTitle;
};

/**
 * user: { fullName: "...", department: "..." }
 * record: { date: Date, status: "...", dailyReport: "...", activeSeconds: 0 }
 */
const syncRecordToSheet = async (user, record) => {
    const instance = getSheetsInstance();
    if (!instance) return;

    const { sheets, spreadsheetId } = instance;
    const dateObj = new Date(record.date || record.clockIn || Date.now());
    const sheetTitle = await ensureMonthSheet(sheets, spreadsheetId, dateObj);
    const c = getISTComponents(dateObj);
    const dayIndex = c.day; // 1-indexed

    const readResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A:B`,
    });

    const values = readResponse.data.values || [];
    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
        if (values[i][0] === user.fullName) {
            rowIndex = i; // 0-indexed
            break;
        }
    }

    if (rowIndex === -1) { // Append new employee block
        const newRows = [
            [user.fullName, user.department || "Employee"],
            ["Daily Update", ""],
            ["Total Time Worked", ""]
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${sheetTitle}'!A:A`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: { values: newRows }
        });

        const newReadResponse = await sheets.spreadsheets.values.get({
            spreadsheetId, range: `'${sheetTitle}'!A:B`
        });
        const newValues = newReadResponse.data.values || [];
        for (let i = 0; i < newValues.length; i++) {
            if (newValues[i][0] === user.fullName) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex !== -1) {
            const spreadsheetData = await sheets.spreadsheets.get({ spreadsheetId });
            const s = spreadsheetData.data.sheets.find(sh => sh.properties.title === sheetTitle);
            if (s) {
                const sheetId = s.properties.sheetId;
                const requests = [];
                // Row 1 (Index rowIndex): Light Green -> RGB 217, 234, 211
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1 },
                        cell: { userEnteredFormat: { backgroundColor: { red: 217 / 255, green: 234 / 255, blue: 211 / 255 }, wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment)"
                    }
                });
                // Row 2 (Index rowIndex + 1): Light Blue -> RGB 207, 226, 243
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex + 1, endRowIndex: rowIndex + 2 },
                        cell: { userEnteredFormat: { backgroundColor: { red: 207 / 255, green: 226 / 255, blue: 243 / 255 }, wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment)"
                    }
                });
                // Row 3 (Index rowIndex + 2): Light Pink -> RGB 244, 204, 204
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex + 2, endRowIndex: rowIndex + 3 },
                        cell: { userEnteredFormat: { backgroundColor: { red: 244 / 255, green: 204 / 255, blue: 204 / 255 }, wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment)"
                    }
                });
                // Let row heights automatically adjust instead of having a fixed size
                // All Borders for the 3 rows
                requests.push({
                    updateBorders: {
                        range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 3 },
                        top: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        bottom: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        left: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        right: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        innerHorizontal: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } },
                        innerVertical: { style: "SOLID", color: { red: 0.8, green: 0.8, blue: 0.8 } }
                    }
                });

                await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });
            }
        }
    }

    if (rowIndex === -1) return; // safety check

    // Check attendance status
    const isPresent = ["clocked-in", "clocked-out", "away"].includes(record.status);
    const isAbsent = record.status === "absent";
    let attendanceStatus = record.status;
    if (isPresent) attendanceStatus = "Present";
    else if (isAbsent) attendanceStatus = "Absent";

    const colLetter = getColumnLetter(1 + dayIndex); // Column A=0, B=1, C=2=01/03. Day 1 -> C (2)

    // Ensure we don't accidentally update outside month range
    const daysInMonth = new Date(c.year, c.month, 0).getDate();
    if (dayIndex > daysInMonth) return;

    // Remove empty daily report string
    let dReport = record.dailyReport || "";
    let workedStr = formatHHMMSS(record.activeSeconds || 0);

    // Update Attendance Status
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!${colLetter}${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[attendanceStatus]] }
    });

    // Update Daily Report Updates
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!${colLetter}${rowIndex + 2}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[dReport]] }
    });

    // Update Total Time Worked
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!${colLetter}${rowIndex + 3}`,
        valueInputOption: "USER_ENTERED",
        resource: { values: [[workedStr]] }
    });
};

module.exports = { syncRecordToSheet, formatHHMMSS, getSheetsInstance };
