const mongoose = require('mongoose');
require('dotenv').config();
require('./models/User');
require('./models/Attendance');
const { getMonthRangeIST } = require('./utils/dateUtils');

async function debug_full() {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.model('User');
    const Attendance = mongoose.model('Attendance');

    const user = await User.findOne({ email: 'dhobleharshwardhan@gmail.com' });
    const { start, end } = getMonthRangeIST(3, 2026);

    const records = await Attendance.find({
        user: user._id,
        date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    console.log(`Found ${records.length} records in range ${start.toISOString()} - ${end.toISOString()}`);
    
    let present = 0;
    records.forEach(r => {
        const isPresent = ["clocked-in", "clocked-out", "away"].includes(r.status);
        if (isPresent) present++;
        console.log(`${r.date.toISOString()} | Status: ${r.status} | Present? ${isPresent}`);
    });
    console.log(`Summary: Present: ${present}, Absent: ${records.filter(r => r.status === 'absent').length}`);

    process.exit(0);
}
debug_full();
