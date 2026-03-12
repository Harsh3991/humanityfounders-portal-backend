const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const Attendance = require("./models/Attendance");
const User = require("./models/User");
const { getTodayRangeIST } = require("./utils/dateUtils");

async function backfillAbsences() {
    console.log("Starting backfill for missing past attendance records...");

    try {
        await connectDB();

        const now = new Date();
        // Derive year/month in IST to avoid UTC date shifting on production servers
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(now.getTime() + IST_OFFSET_MS);
        const year = nowIST.getUTCFullYear();
        const month = nowIST.getUTCMonth();       // 0-indexed
        const todayISTDay = nowIST.getUTCDate();  // IST day-of-month

        const { start: todayStart } = getTodayRangeIST(now);

        const activeUsers = await User.find({ status: "active" });

        for (const user of activeUsers) {
            // Do not mark absent for days before the user actually joined the system
            const { start: userJoinedStart } = getTodayRangeIST(new Date(user.createdAt));

            // Iterate 1st of the month up to (but not including) today in IST
            for (let d = 1; d < todayISTDay; d++) {
                // Use midday UTC so getTodayRangeIST reliably returns the correct IST day
                const checkDate = new Date(Date.UTC(year, month, d, 12, 0, 0));
                const { start: dayStart, end: dayEnd } = getTodayRangeIST(checkDate);

                if (dayStart < userJoinedStart) continue;
                if (dayStart >= todayStart) continue;

                const existingRecord = await Attendance.findOne({
                    user: user._id,
                    date: { $gte: dayStart, $lte: dayEnd }
                });

                if (!existingRecord) {
                    const displayDate = new Date(dayStart.getTime() + IST_OFFSET_MS).toDateString();
                    console.log(`Backfilling absence for ${user.fullName} on ${displayDate} (IST)...`);
                    const absentRecord = new Attendance({
                        user: user._id,
                        date: dayStart, // IST-normalized midnight date
                        status: "absent",
                        activeSeconds: 0,
                        dailyReport: "System automatically marked absent (Past no clock-in)."
                    });

                    // .save() will natively trigger the Mongoose hook, piping this directly into Google Sheets!
                    await absentRecord.save();
                }
            }
        }

        console.log("\n✅ Absence backfill complete! The Google Sheet should now display 'Absent' for all missed past days.");
    } catch (error) {
        console.error("❌ Backfill error:", error);
    } finally {
        process.exit(0);
    }
}

backfillAbsences();
