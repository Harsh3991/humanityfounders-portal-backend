// sendMonthlyReportToHarshwardhan.js
require("dotenv").config();
const Project = require("./models/Project");
const mongoose = require("mongoose");
const User = require("./models/User");
const { buildAndSendMonthlyReport } = require("./utils/cronJobs");
const { getNowIST } = require("./utils/dateUtils");

async function run() {
    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOne({ email: "dhobleharshwardhan@gmail.com" });
    if (!user) {
        console.error("User not found");
        process.exit(1);
    }

    // Use current IST month/year
    const { month, year } = getNowIST();
    await buildAndSendMonthlyReport(user, month, year);

    mongoose.disconnect();
}

run();