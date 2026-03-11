const { CronJob } = require("cron");
const Task = require("../models/Task");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const { sendOverdueTaskEmail, sendAbsentEmail, sendMonthlyReportEmail } = require("./emailService");
const { getMonthRangeIST } = require("./dateUtils");

// ═══════════════════════════════════════════════════════════
// Shared helper — build & send the monthly report for ONE user
// month: 1-indexed (1=January ... 12=December)
// year:  full 4-digit year
// ═══════════════════════════════════════════════════════════
const buildAndSendMonthlyReport = async (user, month, year) => {
    const MONTH_NAMES = ["January","February","March","April","May","June",
                         "July","August","September","October","November","December"];
    const monthName = MONTH_NAMES[month - 1];

    // Use official IST boundaries to match portal calculations
    const { start: monthStart, end: monthEnd } = getMonthRangeIST(month, year);

    // ── Attendance ──────────────────────────────────────────
    const allAttendance = await Attendance.find({
        user: user._id,
        date: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    // Filter strictly for records that fall within the target month in IST
    const attendanceRecords = allAttendance.filter(r => {
        const istDate = new Date(r.date.getTime() + 5.5 * 3600 * 1000);
        return (istDate.getUTCMonth() + 1) === month;
    });

    const daysPresent = attendanceRecords.filter(r =>
        ["clocked-in", "clocked-out", "away"].includes(r.status)
    ).length;
    const daysAbsent = attendanceRecords.filter(r => r.status === "absent").length;
    const totalDays  = attendanceRecords.length;
    const totalActiveSeconds = attendanceRecords.reduce((s, r) => s + (r.activeSeconds || 0), 0);
    const totalWorkingHours  = Math.round((totalActiveSeconds / 3600) * 10) / 10;
    
    const attendanceRate = totalDays > 0
        ? Math.round((daysPresent / totalDays) * 100)
        : 0;

    // ── Tasks ────────────────────────────────────────────────
    const allAssignments = await Task.find({ assignees: user._id })
        .populate("project", "name")
        .lean();

    // Only count Main Tasks (no parentTask) for the stats
    const mainTasks = allAssignments.filter(t => !t.parentTask);
    
    const completedThisMonth = allAssignments.filter(t => {
        if (t.status !== "done" || !t.completedAt) return false;
        const comp = new Date(t.completedAt);
        return comp >= monthStart && comp <= monthEnd;
    }).map(t => ({
        name:    t.name,
        project: t.project?.name || "—",
        isMain:  !t.parentTask
    }));

    const doneMainCount = completedThisMonth.filter(t => t.isMain).length;
    const inProgressMain = mainTasks.filter(t => t.status === "in-progress").length;

    // ── Send ─────────────────────────────────────────────────
    await sendMonthlyReportEmail(user.email, user.fullName, {
        monthName,
        year,
        daysPresent,
        daysAbsent,
        totalDays,
        totalWorkingHours,
        completedTasks: completedThisMonth, // Full list shown in table
        inProgressTasks: inProgressMain,
        totalTasks: mainTasks.length,
        attendanceRate,
    });

    console.log(`✅ Monthly report sent → ${user.fullName} <${user.email}>`);
};

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
                let record = await Attendance.findOne({
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

    dailyJob.start();
    console.log("🕒 Cron jobs scheduled. Daily job set for 12:00 AM (Midnight).");

    // ── Monthly report job — last day of month at 8 PM IST (14:30 UTC) ──
    const monthlyReportJob = new CronJob("30 14 28-31 * *", async function () {
        const now       = new Date();
        const todayDate = now.getDate();
        const daysInThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        // Only send on the actual last day of the month
        if (todayDate !== daysInThisMonth) return;

        const month = now.getMonth() + 1; // 1-indexed
        const year  = now.getFullYear();

        console.log(`📊 Running monthly report job for ${month}/${year}...`);

        try {
            const activeUsers = await User.find({ status: "active" }).lean();
            for (const user of activeUsers) {
                try {
                    await buildAndSendMonthlyReport(user, month, year);
                } catch (err) {
                    console.error(`❌ Monthly report failed for ${user.fullName}:`, err.message);
                }
            }
            console.log(`✅ Monthly reports sent to ${activeUsers.length} employees.`);
        } catch (error) {
            console.error("❌ Monthly report cron failed:", error);
        }
    });

    monthlyReportJob.start();
    console.log("📅 Monthly report job scheduled (last day of each month, 8 PM IST).");

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

module.exports = { startCronJobs, buildAndSendMonthlyReport };
