require("dotenv").config();
const mongoose = require("mongoose");
const Attendance = require("./models/Attendance");
const User = require("./models/User");
const googleSheetsService = require("./services/googleSheetsService");
const { getMonthRangeIST } = require("./utils/dateUtils");

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

async function runMigration() {
    try {
        const today = new Date();

        const instance = googleSheetsService.getSheetsInstance ? googleSheetsService.getSheetsInstance() : null;
        if (instance) {
            const { sheets, spreadsheetId } = instance;
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            // Recreate the target month
            const cMonth = monthNames[today.getMonth()] + " " + today.getFullYear();
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === cMonth);

            if (sheet) {
                console.log(`Deleting old sheet: ${cMonth}`);
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    resource: {
                        requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }]
                    }
                });
                console.log(`Deleted ${cMonth} successfully.`);
            }
        }

        // March is month = 3
        const start = new Date(Date.UTC(today.getUTCFullYear(), 2, 1, 0, 0, 0)); // March 1st UTC
        const end = today; // up to now

        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const range = getMonthRangeIST(month, year); // e.g., March 2026 range

        const records = await Attendance.find({
            date: { $gte: range.start, $lte: range.end }
        }).populate("user", "fullName department").sort({ date: 1 });

        console.log(`Found ${records.length} attendance records for ${month}/${year}. Syncing...`);

        for (const record of records) {
            if (!record.user) continue;
            const userData = { fullName: record.user.fullName, department: record.user.department || "" };
            await googleSheetsService.syncRecordToSheet(userData, record);
            console.log(`Synced record for ${userData.fullName} on ${record.date.toISOString()}`);
            await new Promise(r => setTimeout(r, 3000));
        }

        console.log("Migration finished successfully!");
    } catch (err) {
        require("fs").writeFileSync("errlog.txt", "Migration error stack trace:\n" + err.stack);
        console.error("Migration error stack trace:", err.stack);
    } finally {
        mongoose.disconnect();
    }
}

runMigration();
