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
        const year = now.getFullYear();
        const month = now.getMonth();

        const activeUsers = await User.find({ status: "active" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const user of activeUsers) {
            // Do not mark absent for days before the user actually joined the system
            const createdDate = new Date(user.createdAt);
            createdDate.setHours(0, 0, 0, 0);

            // Iterate 1st of the month up to yesterday
            for (let d = 1; d < today.getDate(); d++) {
                const checkDate = new Date(year, month, d);

                if (checkDate < createdDate) continue;

                const nextDay = new Date(checkDate);
                nextDay.setDate(nextDay.getDate() + 1);

                const existingRecord = await Attendance.findOne({
                    user: user._id,
                    date: { $gte: checkDate, $lt: nextDay }
                });

                if (!existingRecord) {
                    console.log(`Backfilling absence for ${user.fullName} on ${checkDate.toDateString()}...`);
                    const absentRecord = new Attendance({
                        user: user._id,
                        date: checkDate,
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
