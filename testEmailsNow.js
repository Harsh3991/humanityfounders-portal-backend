require("dotenv").config();
const mongoose = require("mongoose");
require("./config/db"); // Connect to DB
const User = require("./models/User");
const Task = require("./models/Task");
const { sendOverdueTaskEmail, sendAbsentEmail } = require("./utils/emailService");

async function testEmails() {
    try {
        console.log("🔍 Testing email functionality...\n");

        // Find Harshwardhan
        const harshwardhan = await User.findOne({ fullName: /harshwardhan/i });
        if (!harshwardhan) {
            console.log("❌ Harshwardhan not found in database");
            process.exit(1);
        }

        console.log(`✅ Found user: ${harshwardhan.fullName} (${harshwardhan.email})\n`);

        // Test 1: Absent Email
        console.log("📧 Test 1: Sending absent email...");
        try {
            await sendAbsentEmail(harshwardhan.email, harshwardhan.fullName, "Wednesday, March 12, 2026");
            console.log("✅ Absent email sent successfully!\n");
        } catch (err) {
            console.log("❌ Absent email failed:", err.message);
            console.error(err);
        }

        // Test 2: Overdue Task Email
        console.log("📧 Test 2: Sending overdue task email...");
        try {
            await sendOverdueTaskEmail(
                harshwardhan.email,
                harshwardhan.fullName,
                "TEST: Sample Overdue Task",
                new Date("2026-03-11")
            );
            console.log("✅ Overdue task email sent successfully!\n");
        } catch (err) {
            console.log("❌ Overdue task email failed:", err.message);
            console.error(err);
        }

        // Test 3: Check Harshwardhan's overdue tasks
        console.log("📋 Test 3: Checking Harshwardhan's overdue tasks...");
        const overdueTasks = await Task.find({
            assignees: harshwardhan._id,
            dueDate: { $lt: new Date() },
            status: { $ne: "done" }
        }).populate("assignees", "fullName email status");

        console.log(`Found ${overdueTasks.length} overdue task(s):\n`);
        for (const task of overdueTasks) {
            console.log(`  - "${task.name}"`);
            console.log(`    Due: ${task.dueDate}`);
            console.log(`    Status: ${task.status}`);
            console.log(`    overdueEmailSent: ${task.overdueEmailSent}`);
            console.log(`    Assignees: ${task.assignees.map(a => `${a.fullName} (${a.status})`).join(", ")}`);
            console.log();
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Wait for connection with timeout
setTimeout(() => {
    console.log("❌ Connection timeout - MongoDB not connected within 10s");
    process.exit(1);
}, 10000);

mongoose.connection.once("open", () => {
    console.log("Connected to MongoDB\n");
    testEmails();
});

mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});
