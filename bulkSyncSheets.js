const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

const connectDB = require("./config/db");
const Attendance = require("./models/Attendance");
const User = require("./models/User");
const googleSheetsService = require("./services/googleSheetsService");

async function manualSyncAll() {
    console.log("🚀 Starting TRUE BULK SYNC (Memory-First Optimized)...");

    try {
        await connectDB();
        const instance = googleSheetsService.getSheetsInstance();
        if (!instance) throw new Error("Google Sheets instance failed");
        const { sheets, spreadsheetId } = instance;

        // 1. Fetch all data
        const users = await User.find({ status: "active" }).lean();
        const records = await Attendance.find({}).lean();

        // 2. Identify the target month (March 2026 for now, or detect from records)
        // For simplicity, we'll sync the current month context
        const now = new Date();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[now.getMonth()];
        const year = now.getFullYear();
        const sheetTitle = `${monthName} ${year}`;
        const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();

        console.log(`📊 Syncing ${users.length} users for ${sheetTitle}...`);

        // 3. Build the Big Matrix
        // Row 0: Header
        const header = ["Employee Name", "Department"];
        for (let d = 1; d <= daysInMonth; d++) {
            header.push(`${String(d).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(year).slice(-2)}`);
        }

        const matrix = [header];
        const userFormatting = []; // To track row indices for batch formatting

        users.sort((a, b) => a.fullName.localeCompare(b.fullName));

        for (const user of users) {
            const userRecords = records.filter(r =>
                r.user.toString() === user._id.toString() &&
                new Date(r.date).getMonth() === now.getMonth() &&
                new Date(r.date).getFullYear() === year
            );

            const row1 = [user.fullName, user.department || "Employee"];
            const row2 = ["Daily Update", ""];
            const row3 = ["Total Time Worked", ""];
            const row4 = ["-", "-"]; // Spacer row

            for (let d = 1; d <= daysInMonth; d++) {
                const record = userRecords.find(r => new Date(r.date).getDate() === d);
                if (record) {
                    const isPresent = ["clocked-in", "clocked-out", "away"].includes(record.status);
                    row1.push(isPresent ? "Present" : (record.status === "absent" ? "Absent" : record.status));
                    row2.push(record.dailyReport || "");
                    row3.push(googleSheetsService.formatHHMMSS(record.activeSeconds || 0));
                } else {
                    row1.push("");
                    row2.push("");
                    row3.push("");
                }
                row4.push("");
            }

            const startIdx = matrix.length;
            matrix.push(row1, row2, row3, row4);
            userFormatting.push({ name: user.fullName, startRow: startIdx });
        }

        // 4. Ensure sheet exists and is clean
        console.log("🧹 Clearing old sheet data...");
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        let sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetTitle);
        let sheetId;

        if (sheet) {
            sheetId = sheet.properties.sheetId;
            await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${sheetTitle}'!A:ZZ` });
        } else {
            const addRes = await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
            });
            sheetId = addRes.data.replies[0].addSheet.properties.sheetId;
        }

        // 5. ONE-SHOT WRITE
        console.log("✍️ Writing entire matrix to Google Sheets...");
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetTitle}'!A1`,
            valueInputOption: "USER_ENTERED",
            resource: { values: matrix }
        });

        // 6. ONE-SHOT FORMATTING
        console.log("🎨 Applying professional formatting...");
        const requests = [
            // Header
            {
                repeatCell: {
                    range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.1, green: 0.1, blue: 0.3 },
                            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontFamily: "Arial" },
                            horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE"
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
                }
            },
            // Column Widths
            { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 250 }, fields: "pixelSize" } },
            { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
            { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: 2 }, properties: { pixelSize: 250 }, fields: "pixelSize" } },
            // Frozen Panes
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1, frozenColumnCount: 2 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } }
        ];

        for (const fmt of userFormatting) {
            const r = fmt.startRow;
            // Row 1: Green
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: r, endRowIndex: r + 1 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.85, green: 0.92, blue: 0.83 },
                            wrapStrategy: "WRAP",
                            verticalAlignment: "MIDDLE",
                            horizontalAlignment: "CENTER",
                            textFormat: { fontFamily: "Arial", bold: true }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat)"
                }
            });
            // Row 2: Blue
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: r + 1, endRowIndex: r + 2 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.81, green: 0.89, blue: 0.95 },
                            wrapStrategy: "WRAP",
                            verticalAlignment: "TOP",
                            horizontalAlignment: "CENTER",
                            textFormat: { fontFamily: "Arial", bold: true, foregroundColor: { red: 0.2, green: 0.3, blue: 0.4 } }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat,textFormat.foregroundColor)"
                }
            });
            // Row 3: Pink
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: r + 2, endRowIndex: r + 3 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.96, green: 0.8, blue: 0.8 },
                            wrapStrategy: "WRAP",
                            verticalAlignment: "MIDDLE",
                            horizontalAlignment: "CENTER",
                            textFormat: { fontFamily: "Arial", bold: true }
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,wrapStrategy,verticalAlignment,horizontalAlignment,textFormat)"
                }
            });
            // Row 4: GAP (Spacer)
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: r + 3, endRowIndex: r + 4 },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 1, green: 1, blue: 1 },
                            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } // Hide placeholder
                        }
                    },
                    fields: "userEnteredFormat(backgroundColor,textFormat)"
                }
            });
            requests.push({
                updateDimensionProperties: {
                    range: { sheetId, dimension: "ROWS", startIndex: r + 3, endIndex: r + 4 },
                    properties: { pixelSize: 35 }, // BIG GAP
                    fields: "pixelSize"
                }
            });
            // Borders
            requests.push({
                updateBorders: {
                    range: { sheetId, startRowIndex: r, endRowIndex: r + 3 },
                    top: { style: "SOLID" }, bottom: { style: "SOLID" }, left: { style: "SOLID" }, right: { style: "SOLID" },
                    innerHorizontal: { style: "SOLID" }, innerVertical: { style: "SOLID" }
                }
            });
        }

        await sheets.spreadsheets.batchUpdate({ spreadsheetId, resource: { requests } });

        console.log(`\n✅ TRUE BULK SYNC COMPLETED! Updated ${users.length} employee blocks.`);
    } catch (error) {
        console.error("❌ Sync failed:", error);
    } finally {
        process.exit(0);
    }
}

manualSyncAll();
