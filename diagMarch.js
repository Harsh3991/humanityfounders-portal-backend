const mongoose = require('mongoose');
require('dotenv').config();
require('./models/User');
require('./models/Attendance');
require('./models/Task');
require('./models/Project');

async function diag() {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.model('User');
    const Attendance = mongoose.model('Attendance');
    const Task = mongoose.model('Task');

    const user = await User.findOne({ email: 'dhobleharshwardhan@gmail.com' });
    if (!user) { console.log("User not found"); process.exit(1); }

    const month = 3;
    const year = 2026;
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    monthStart.setUTCHours(monthStart.getUTCHours() - 6);
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    monthEnd.setUTCHours(monthEnd.getUTCHours() + 12);

    console.log(`Range: ${monthStart.toISOString()} - ${monthEnd.toISOString()}`);

    const records = await Attendance.find({
        user: user._id,
        date: { $gte: monthStart, $lte: monthEnd }
    }).sort({ date: 1 });

    let present = 0;
    let absent = 0;
    let totalSec = 0;

    console.log("\n--- Attendance Records ---");
    records.forEach(r => {
        const isPresent = ["clocked-in", "clocked-out", "away"].includes(r.status);
        if (isPresent) present++;
        else if (r.status === 'absent') absent++;
        totalSec += (r.activeSeconds || 0);
        console.log(`${r.date.toISOString()} | Status: ${r.status} | Sec: ${r.activeSeconds || 0}`);
    });

    console.log(`\nTotals: Present: ${present}, Absent: ${absent}, Hours: ${(totalSec/3600).toFixed(2)}`);

    const tasks = await Task.find({ assignees: user._id }).lean();
    console.log(`\n--- Tasks Found (Total: ${tasks.length}) ---`);
    const parentCount = tasks.filter(t => !t.parentTask).length;
    const subCount = tasks.filter(t => t.parentTask).length;
    console.log(`Top-level tasks: ${parentCount}`);
    console.log(`Subtasks (nested): ${subCount}`);

    process.exit(0);
}
diag();
