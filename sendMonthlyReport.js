/**
 * sendMonthlyReport.js — On-demand monthly report tester
 */
require("dotenv").config();
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);

const connectDB    = require("./config/db");
const User         = require("./models/User");

// Pre-load models so Mongoose's registry is complete before any populate() runs
require("./models/Attendance");
require("./models/Task");
require("./models/Project");

const { buildAndSendMonthlyReport } = require("./utils/cronJobs");

async function main() {
    const [,, emailArg, monthArg, yearArg] = process.argv;

    if (!emailArg) {
        console.error("❌  Usage: node sendMonthlyReport.js <email> [month] [year]");
        process.exit(1);
    }

    const now   = new Date();
    const month = monthArg ? parseInt(monthArg, 10) : now.getMonth() + 1;
    const year  = yearArg  ? parseInt(yearArg,  10) : now.getFullYear();

    await connectDB();

    const user = await User.findOne({ email: emailArg.toLowerCase().trim() }).lean();
    if (!user) {
        console.error(`❌  No user found with email: ${emailArg}`);
        process.exit(1);
    }

    console.log(`\n📊 Sending monthly report for:`);
    console.log(`   Employee : ${user.fullName}`);
    console.log(`   Email    : ${user.email}`);
    console.log(`   Period   : ${month}/${year}`);

    try {
        await buildAndSendMonthlyReport(user, month, year);
        console.log(`\n✅ Done! Check ${user.email} for the report.`);
    } catch (err) {
        console.error("❌ Failed:", err.message);
    }

    process.exit(0);
}

main();
