/**
 * resendOverdueEmails.js
 *
 * Finds all overdue tasks whose email was never confirmed delivered
 * (overdueEmailSent = true but the email may have failed silently),
 * OR tasks that are genuinely overdue and have overdueEmailSent = false.
 *
 * Usage:
 *   node resendOverdueEmails.js          -- resend for ALL overdue tasks (resets flag)
 *   node resendOverdueEmails.js --dry    -- preview only, no emails sent
 */
require("dotenv").config();
const mongoose = require("mongoose");
require("./models/User");
require("./models/Project");
const Task = require("./models/Task");
const { sendOverdueTaskEmail } = require("./utils/emailService");
const { getTodayRangeIST } = require("./utils/dateUtils");

const DRY_RUN = process.argv.includes("--dry");

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB\n");

    const { start: todayStartIST } = getTodayRangeIST();
    console.log("Today (IST) start:", todayStartIST.toISOString());

    // Find ALL overdue tasks (not done, past IST due date) regardless of email flag
    const overdueTasks = await Task.find({
        status: { $ne: "done" },
        dueDate: { $lt: todayStartIST },
    })
        .populate("assignees", "fullName email status")
        .lean();

    console.log(`\nFound ${overdueTasks.length} overdue task(s) to process:\n`);

    let sent = 0;
    let failed = 0;

    for (const task of overdueTasks) {
        const activeAssignees = (task.assignees || []).filter(a => a.status === "active");

        if (activeAssignees.length === 0) {
            console.log(`  [SKIP] "${task.name}" — no active assignees`);
            continue;
        }

        console.log(`  [TASK] "${task.name}" | Due: ${new Date(task.dueDate).toISOString()} | Assignees: ${activeAssignees.map(a => a.fullName).join(", ")}`);

        if (DRY_RUN) {
            console.log(`         → DRY RUN: would send to ${activeAssignees.length} assignee(s)`);
            continue;
        }

        // Send to all active assignees
        let allSent = true;
        for (const assignee of activeAssignees) {
            const ok = await sendOverdueTaskEmail(assignee.email, assignee.fullName, task.name, task.dueDate);
            if (ok) {
                console.log(`         ✅ Sent to ${assignee.fullName} <${assignee.email}>`);
                sent++;
            } else {
                console.log(`         ❌ FAILED for ${assignee.fullName} <${assignee.email}>`);
                failed++;
                allSent = false;
            }
        }

        // Only mark the flag if ALL emails for this task went through
        if (allSent) {
            await Task.findByIdAndUpdate(task._id, { overdueEmailSent: true });
            console.log(`         ✔ overdueEmailSent set to true`);
        } else {
            // Reset to false so tomorrow's cron retries
            await Task.findByIdAndUpdate(task._id, { overdueEmailSent: false });
            console.log(`         ⚠ overdueEmailSent KEPT false (will retry on next cron)`);
        }
    }

    if (!DRY_RUN) {
        console.log(`\n📊 Summary: ${sent} email(s) sent, ${failed} failed`);
    } else {
        console.log(`\nDRY RUN complete — no emails sent, no DB changes made`);
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
