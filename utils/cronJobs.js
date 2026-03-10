const { CronJob } = require("cron");
const Task = require("../models/Task");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const { sendOverdueTaskEmail, sendAbsentEmail } = require("./emailService");

const startCronJobs = () => {
    // Run every day at 12:00 AM server time (midnight)
    const dailyJob = new CronJob("0 0 * * *", async function () {
        console.log("⏱️ Running daily cron jobs for overdue tasks and absences...");

        try {
            const now = new Date();

            // 1. Process Overdue Tasks
            const overdueTasks = await Task.find({
                status: { $ne: "done" },
                dueDate: { $lt: now }, // Past the due date
                overdueEmailSent: false, // Ensure we don't spam
            }).populate("assignees");

            for (const task of overdueTasks) {
                for (const assignee of task.assignees) {
                    // Send email only if user is active
                    if (assignee.status === "active") {
                        await sendOverdueTaskEmail(assignee.email, assignee.fullName, task.name, task.dueDate);
                    }
                }

                // Mark as sent to prevent duplicate emails
                task.overdueEmailSent = true;
                await task.save();
            }

            // 2. Process Absent Days for Yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const activeUsers = await User.find({ status: "active" });

            for (const user of activeUsers) {
                // Find if user has attendance for yesterday
                const record = await Attendance.findOne({
                    user: user._id,
                    date: { $gte: yesterday, $lt: today }
                });

                // If there's no record, officially create one to trigger the sheet sync
                if (!record) {
                    record = new Attendance({
                        user: user._id,
                        date: yesterday,
                        status: "absent",
                        activeSeconds: 0,
                        dailyReport: "System marked absent (No clock in/out)."
                    });
                    await record.save(); // Trigger Mongoose post-save hook to update Google Sheet

                    const dateStr = yesterday.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    await sendAbsentEmail(user.email, user.fullName, dateStr);
                } else if (record.status === "absent") {
                    const dateStr = yesterday.toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    await sendAbsentEmail(user.email, user.fullName, dateStr);
                }
            }

            console.log("✅ Daily cron jobs executed successfully.");
        } catch (error) {
            console.error("❌ Error running daily cron jobs:", error);
        }
    });

    // Start the cron job
    dailyJob.start();
    console.log("🕒 Cron jobs scheduled. Daily job set for 12:00 AM (Midnight).");

    // 3. Keep-alive job to prevent Heroku from sleeping (Runs every 15 minutes)
    // IMPORTANT: Make sure to set APP_URL in environment variables
    const keepAliveJob = new CronJob("*/15 * * * *", async function () {
        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            return; // Silently skip if no URL is provided
        }

        try {
            const https = require('https');
            const http = require('http');
            const protocol = appUrl.startsWith('https') ? https : http;

            protocol.get(`${appUrl}/api/health`, (res) => {
                if (res.statusCode === 200) {
                    console.log("⚡ Keep-alive ping successful. Server stays awake.");
                }
            }).on('error', (e) => {
                console.error(`❌ Keep-alive ping failed: ${e.message}`);
            });
        } catch (err) {
            console.error("❌ Error in keep-alive cron:", err);
        }
    });

    if (process.env.NODE_ENV === "production") {
        keepAliveJob.start();
        console.log("🚀 Keep-alive job started (15m interval).");
    }
};

module.exports = { startCronJobs };
