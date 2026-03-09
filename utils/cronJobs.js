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
};

module.exports = { startCronJobs };
