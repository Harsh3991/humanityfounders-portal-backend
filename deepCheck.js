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

    console.log('Query Start:', start.toISOString());
    console.log('Query End:  ', end.toISOString());

    const records = await Attendance.find({
        user: user._id,
        date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    console.log('\n--- Records ---');
    records.forEach(r => {
        const istDate = new Date(r.date.getTime() + 5.5 * 3600 * 1000);
        console.log(`${istDate.toISOString()} (IST) | DB Date: ${r.date.toISOString()} | Status: ${r.status} | Hours: ${(r.activeSeconds/3600).toFixed(2)}`);
    });

    process.exit(0);
}
check();
