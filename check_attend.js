const mongoose = require('mongoose');
require('dotenv').config();
require('./models/User');
require('./models/Attendance');
const { getMonthRangeIST } = require('./utils/dateUtils');

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const User = mongoose.model('User');
    const Attendance = mongoose.model('Attendance');

    const user = await User.findOne({ email: 'dhobleharshwardhan@gmail.com' });
    const { start, end } = getMonthRangeIST(3, 2026);

    const records = await Attendance.find({
        user: user._id,
        date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    console.log(`User: ${user.fullName}`);
    console.log('Query Range:', start.toISOString(), 'to', end.toISOString());
    console.log(`Found ${records.length} records\n`);

    records.forEach(r => {
        console.log(`${r.date.toISOString()} | Status: ${r.status} | Sec: ${r.activeSeconds || 0}`);
    });

    process.exit(0);
}
check();
