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
    console.log("Starting manual bulk sync of all database records to Google Sheets...");

    try {
        await connectDB();

        // Fetch all attendance records
        const records = await Attendance.find({}).populate("user", "fullName department").lean();

        console.log(`Found ${records.length} records in the database. Syncing...`);

        let successCount = 0;

        for (const record of records) {
            if (!record.user) continue; // Skip if user was deleted

            const userData = {
                fullName: record.user.fullName,
                department: record.user.department
            };

            await googleSheetsService.syncRecordToSheet(userData, record);
            successCount++;

            // Log progress
            if (successCount % 5 === 0) {
                console.log(`Synced ${successCount}/${records.length} records...`);
            }
        }

        console.log(`\n✅ Bulk sync completed! Successfully synced ${successCount} records.`);
    } catch (error) {
        console.error("❌ Sync encountered an error:", error);
    } finally {
        process.exit(0);
    }
}

manualSyncAll();
