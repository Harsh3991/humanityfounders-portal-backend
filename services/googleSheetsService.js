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
                                    textFormat: { foregroundColor: { red: 0.2, green: 0.3, blue: 0.4 }, bold: true, fontFamily: "Arial" }, // Dark slate
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
                            range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
                            properties: { pixelSize: 250 },
                            fields: "pixelSize"
                        }
                    },
                    {
                        updateDimensionProperties: {
                            range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
                            properties: { pixelSize: 180 },
                            fields: "pixelSize"
                        }
                    },
                    {
                        updateDimensionProperties: {
                            range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 2 },
                            properties: { pixelSize: 250 },
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
            ["Total Time Worked", ""],
            ["-", "-"] // Visible spacer to ensure Row counts are incremented correctly by Sheets
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
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 217 / 255, green: 234 / 255, blue: 211 / 255 },
                                wrapStrategy: "WRAP",
                                verticalAlignment: "TOP",
                                horizontalAlignment: "CENTER",
                                textFormat: { fontFamily: "Arial", bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } }
                            }
                        },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat)"
                    }
                });
                // Row 2 (Index rowIndex + 1): Light Blue -> RGB 207, 226, 243
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex + 1, endRowIndex: rowIndex + 2 },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 207 / 255, green: 226 / 255, blue: 243 / 255 },
                                wrapStrategy: "WRAP",
                                verticalAlignment: "TOP",
                                horizontalAlignment: "CENTER",
                                textFormat: { fontFamily: "Arial", bold: true, foregroundColor: { red: 0.2, green: 0.3, blue: 0.4 } }
                            }
                        },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat)"
                    }
                });
                // Row 3 (Index rowIndex + 2): Light Pink -> RGB 244, 204, 204
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex + 2, endRowIndex: rowIndex + 3 },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 244 / 255, green: 204 / 255, blue: 204 / 255 },
                                wrapStrategy: "WRAP",
                                verticalAlignment: "TOP",
                                horizontalAlignment: "CENTER",
                                textFormat: { fontFamily: "Arial", bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } }
                            }
                        },
                        fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat)"
                    }
                });
                // Row 4 (Index rowIndex + 3): Spacer row - adjust height and background
                requests.push({
                    repeatCell: {
                        range: { sheetId, startRowIndex: rowIndex + 3, endRowIndex: rowIndex + 4 },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.98, green: 0.98, blue: 0.98 },
                                textFormat: { foregroundColor: { red: 0.98, green: 0.98, blue: 0.98 } } // Hide the "-" character
                            }
                        },
                        fields: "userEnteredFormat(backgroundColor,textFormat)"
                    }
                });
                requests.push({
                    updateDimensionProperties: {
                        range: { sheetId, dimension: "ROWS", startIndex: rowIndex + 3, endIndex: rowIndex + 4 },
                        properties: { pixelSize: 25 },
                        fields: "pixelSize"
                    }
                });
                // All Borders for the 3 main rows
                requests.push({
                    updateBorders: {
                        range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 3 },
                        top: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } },
                        bottom: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } },
                        left: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } },
                        right: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } },
                        innerHorizontal: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } },
                        innerVertical: { style: "SOLID", color: { red: 0.6, green: 0.6, blue: 0.6 } }
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

    // BATCH UPDATE: All 3 rows in one call to avoid rate limits
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!${colLetter}${rowIndex + 1}:${colLetter}${rowIndex + 3}`,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [
                [attendanceStatus],
                [dReport],
                [workedStr]
            ]
        }
    });
};

/**
 * Remove all rows for a given employee (by name) from every month sheet tab.
 * Deletes the 4-row block (name row + daily update + total time + spacer).
 * employeeName: string — must match the cell A value exactly.
 */
const removeEmployeeFromSheets = async (employeeName) => {
    const instance = getSheetsInstance();
    if (!instance) return;
    const { sheets, spreadsheetId } = instance;

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const allSheets = spreadsheet.data.sheets || [];

        for (const sheetMeta of allSheets) {
            const sheetTitle = sheetMeta.properties.title;
            const sheetId = sheetMeta.properties.sheetId;

            // Read column A to find the employee row
            const readRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetTitle}'!A:A`,
            });

            const colA = readRes.data.values || [];
            let rowIndex = -1;
            for (let i = 0; i < colA.length; i++) {
                if (colA[i] && colA[i][0] === employeeName) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) continue; // This employee has no rows on this sheet

            // Delete 4 rows starting at rowIndex (0-indexed)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndex,
                                endIndex: rowIndex + 4  // name + daily update + total time + spacer
                            }
                        }
                    }]
                }
            });

            console.log(`🗑️  Removed employee "${employeeName}" from sheet tab "${sheetTitle}" (rows ${rowIndex + 1}–${rowIndex + 4})`);
        }
    } catch (err) {
        console.error(`❌ removeEmployeeFromSheets failed for "${employeeName}":`, err.message);
    }
};

/**
 * Update an employee's name and/or department across ALL month sheet tabs.
 * Call this after updating a user profile (fullName or department changed).
 *
 * oldName:      the name currently in the sheet (before the update)
 * newName:      the updated full name
 * newDepartment: the updated department
 */
const renameEmployeeInSheets = async (oldName, newName, newDepartment) => {
    const instance = getSheetsInstance();
    if (!instance) return;
    const { sheets, spreadsheetId } = instance;

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const allSheets = spreadsheet.data.sheets || [];

        for (const sheetMeta of allSheets) {
            const sheetTitle = sheetMeta.properties.title;

            // Read columns A & B to find the row and confirm the name
            const readRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetTitle}'!A:B`,
            });

            const rows = readRes.data.values || [];
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i] && rows[i][0] === oldName) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex === -1) continue; // Not on this sheet tab

            // Update A (name) and B (department) for the employee header row only
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `'${sheetTitle}'!A${rowIndex + 1}:B${rowIndex + 1}`,
                valueInputOption: "USER_ENTERED",
                resource: { values: [[newName, newDepartment || rows[rowIndex][1] || "Employee"]] }
            });

            console.log(`✏️  Renamed "${oldName}" → "${newName}" on sheet tab "${sheetTitle}" (row ${rowIndex + 1})`);
        }
    } catch (err) {
        console.error(`❌ renameEmployeeInSheets failed for "${oldName}":`, err.message);
    }
};

module.exports = { syncRecordToSheet, formatHHMMSS, getSheetsInstance, removeEmployeeFromSheets, renameEmployeeInSheets };

