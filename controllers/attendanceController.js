const Attendance = require("../models/Attendance");
const User = require("../models/User");

/**
 * Helper: get today's date range
 */
const getTodayRange = () => {
    const now = new Date();
    // Use local time for date boundaries
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
};

/**
 * Helper: get or create today's attendance record
 */
const getRecordForClockIn = async (userId) => {
    const { start } = getTodayRange();

    // Check if there is ALREADY an active session (clocked-in or away) regardless of date
    // Prevents starting a new session while one is running from yesterday
    const activeRecord = await Attendance.findOne({
        user: userId,
        status: { $in: ["clocked-in", "away"] }
    });

    if (activeRecord) return { record: activeRecord, isNew: false, isActive: true };

    // Check for today's record (could be clocked-out from a previous session today)
    let record = await Attendance.findOne({
        user: userId,
        date: start,
    });

    if (!record) {
        // Create new record for today
        record = new Attendance({
            user: userId,
            date: start,
            status: "absent",
            activeSeconds: 0,
            clockIn: new Date(), // Set INITIAL clock-in time for the day
            sessions: []
        });
        return { record, isNew: true, isActive: false };
    }

    return { record, isNew: false, isActive: false };
};

/**
 * Helper: get active record for actions (Away, Resume, Clock Out)
 */
const getActiveRecord = async (userId) => {
    // Find any record where user is currently clocked in or away
    // This handles cross-day shifts
    return await Attendance.findOne({
        user: userId,
        status: { $in: ["clocked-in", "away"] }
    });
};

// ═══════════════════════════════════════════════
// POST /api/attendance/clock-in
// ═══════════════════════════════════════════════
const clockIn = async (req, res, next) => {
    try {
        const { record, isNew, isActive } = await getRecordForClockIn(req.user._id);

        if (isActive) {
            return res.status(400).json({
                success: false,
                message: "You are already clocked in. Please clock out first.",
            });
        }

        const now = new Date();

        // Start a new work segment
        record.status = "clocked-in";
        record.lastActiveAt = now;

        // If it's a fresh record, set user Ref if needed (already set in create)
        // Mongoose handles saving

        await record.save();

        res.status(200).json({
            success: true,
            message: "Clocked in successfully ⏱️",
            data: {
                clockIn: record.clockIn, // Returns the DAY's first clock-in
                status: record.status,
                activeSeconds: record.activeSeconds, // Returns cumulative seconds so far
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// POST /api/attendance/away
// ═══════════════════════════════════════════════
const goAway = async (req, res, next) => {
    try {
        const record = await getActiveRecord(req.user._id);

        if (!record || record.status !== "clocked-in") {
            return res.status(400).json({
                success: false,
                message: "You must be clocked in to go away",
            });
        }

        const now = new Date();

        // Accumulate active time from the last active segment
        if (record.lastActiveAt) {
            const segmentSeconds = Math.floor((now - record.lastActiveAt) / 1000);
            record.activeSeconds += segmentSeconds;

            // Log this work session
            if (!record.sessions) record.sessions = [];
            record.sessions.push({
                start: record.lastActiveAt,
                end: now,
                duration: segmentSeconds
            });
        }

        // Start a new break
        record.breaks.push({ start: now });
        record.status = "away";
        record.lastActiveAt = null; // timer paused

        await record.save();

        res.status(200).json({
            success: true,
            message: "Timer paused — enjoy your break ☕",
            data: {
                status: record.status,
                activeSeconds: record.activeSeconds,
                breakStart: now,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// POST /api/attendance/resume
// ═══════════════════════════════════════════════
const resume = async (req, res, next) => {
    try {
        const record = await getActiveRecord(req.user._id);

        if (!record || record.status !== "away") {
            return res.status(400).json({
                success: false,
                message: "You are not on a break",
            });
        }

        const now = new Date();

        // Close the current break
        const currentBreak = record.breaks[record.breaks.length - 1];
        if (currentBreak && !currentBreak.end) {
            currentBreak.end = now;
            currentBreak.duration = Math.floor((now - currentBreak.start) / 1000);
        }

        record.status = "clocked-in";
        record.lastActiveAt = now; // restart active timer (start new session segment)

        await record.save();

        res.status(200).json({
            success: true,
            message: "Welcome back! Timer resumed ⏱️",
            data: {
                status: record.status,
                activeSeconds: record.activeSeconds,
                lastActiveAt: record.lastActiveAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// POST /api/attendance/clock-out
// Body: { dailyReport: "What was accomplished" }
// ═══════════════════════════════════════════════
const clockOut = async (req, res, next) => {
    try {
        const record = await getActiveRecord(req.user._id);

        if (!record) {
            return res.status(400).json({
                success: false,
                message: "You are not clocked in. Please clock in first.",
            });
        }

        const { dailyReport } = req.body;

        if (!dailyReport || !dailyReport.trim()) {
            return res.status(400).json({
                success: false,
                message: "Daily report is required when clocking out",
            });
        }

        const now = new Date();

        // If currently active (not away), accumulate remaining active time
        if (record.status === "clocked-in" && record.lastActiveAt) {
            const segmentSeconds = Math.floor((now - record.lastActiveAt) / 1000);
            record.activeSeconds += segmentSeconds;

            // Log this work session
            if (!record.sessions) record.sessions = [];
            record.sessions.push({
                start: record.lastActiveAt,
                end: now,
                duration: segmentSeconds
            });
        }

        // If away, close the open break before clocking out
        if (record.status === "away") {
            const currentBreak = record.breaks[record.breaks.length - 1];
            if (currentBreak && !currentBreak.end) {
                currentBreak.end = now;
                currentBreak.duration = Math.floor((now - currentBreak.start) / 1000);
            }
        }

        record.clockOut = now; // Update to latest clock-out time
        record.status = "clocked-out";
        record.lastActiveAt = null;

        // Append report if one exists (for multi-session days)
        if (record.dailyReport) {
            record.dailyReport += `\n[${now.toLocaleTimeString()}]: ${dailyReport.trim()}`;
        } else {
            record.dailyReport = dailyReport.trim();
        }

        await record.save();

        // Calculate total break time
        const totalBreakSeconds = record.breaks.reduce(
            (sum, b) => sum + (b.duration || 0),
            0
        );

        res.status(200).json({
            success: true,
            message: "Clocked out — great work!",
            data: {
                clockIn: record.clockIn,
                clockOut: record.clockOut,
                activeSeconds: record.activeSeconds,
                totalBreakSeconds,
                dailyReport: record.dailyReport,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/attendance/today
// Get today's attendance status for the current user
// ═══════════════════════════════════════════════
const getToday = async (req, res, next) => {
    try {
        // First check for ANY active record (handles cross-day)
        let record = await getActiveRecord(req.user._id);

        // If no active record, fetch today's record (could be clocked-out)
        if (!record) {
            const { start } = getTodayRange();
            record = await Attendance.findOne({
                user: req.user._id,
                date: start
            });
        }

        if (!record) {
            return res.status(200).json({
                success: true,
                data: {
                    status: "absent",
                    clockIn: null,
                    clockOut: null,
                    activeSeconds: 0,
                    dailyReport: "",
                    lastActiveAt: null
                }
            });
        }

        // If currently active, calculate live active seconds
        let liveActiveSeconds = record.activeSeconds || 0;
        if (record.status === "clocked-in" && record.lastActiveAt) {
            const now = new Date();
            liveActiveSeconds += Math.floor((now - record.lastActiveAt) / 1000);
        }

        const totalBreakSeconds = record.breaks.reduce(
            (sum, b) => sum + (b.duration || 0),
            0
        );

        res.status(200).json({
            success: true,
            data: {
                status: record.status,
                clockIn: record.clockIn || null,
                clockOut: record.clockOut || null,
                activeSeconds: liveActiveSeconds,
                totalBreakSeconds,
                breaksCount: record.breaks.length,
                lastActiveAt: record.lastActiveAt,
                dailyReport: record.dailyReport || "",
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/attendance/history?month=2&year=2026
// Get monthly attendance history for the current user
// ═══════════════════════════════════════════════
const getHistory = async (req, res, next) => {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || now.getMonth() + 1; // 1-12
        const year = parseInt(req.query.year) || now.getFullYear();

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const records = await Attendance.find({
            user: req.user._id,
            date: { $gte: start, $lte: end },
        })
            .select("date status clockIn clockOut activeSeconds dailyReport")
            .sort({ date: 1 })
            .lean();

        // Calculate stats
        const daysPresent = records.filter(
            (r) => ["clocked-in", "clocked-out", "away"].includes(r.status)
        ).length;

        const totalActiveSeconds = records.reduce(
            (sum, r) => sum + (r.activeSeconds || 0),
            0
        );

        res.status(200).json({
            success: true,
            data: {
                month,
                year,
                records,
                stats: {
                    daysPresent,
                    totalWorkingHours:
                        Math.round((totalActiveSeconds / 3600) * 10) / 10,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/attendance/admin/status
// Get current status of all users (for Admin Dashboard/Directory)
// ═══════════════════════════════════════════════
const getAllUsersStatus = async (req, res, next) => {
    try {
        const { start } = getTodayRange();

        // 1. Get all active users
        console.log("Fetching users for directory...");
        const users = await User.find({ status: { $ne: "inactive" } })
            .select("fullName email role department status avatar")
            .lean();
        console.log(`Found ${users.length} users`);

        // 2. Get all attendance records for today OR active sessions from yesterday
        const activeRecords = await Attendance.find({
            $or: [
                { date: start },
                { status: { $in: ["clocked-in", "away"] } }
            ]
        }).lean();

        // 3. Map status to users with O(1) lookup
        const activeRecordMap = {};
        activeRecords.forEach(r => {
            const rUserId = String(r.user);
            if (["clocked-in", "away"].includes(r.status)) {
                activeRecordMap[rUserId] = r;
            } else if (new Date(r.date).getTime() === start.getTime() && !activeRecordMap[rUserId]) {
                activeRecordMap[rUserId] = r;
            }
        });

        const userStatusList = users.map((user) => {
            const record = activeRecordMap[String(user._id)];

            return {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                department: user.department,
                status: record ? record.status : "absent",
                clockIn: record ? record.clockIn : null,
                clockOut: record ? record.clockOut : null,
                activeSeconds: record ? record.activeSeconds : 0,
                lastActiveAt: record ? record.lastActiveAt : null
            };
        });

        res.status(200).json({
            success: true,
            count: userStatusList.length,
            data: userStatusList,
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/attendance/admin/:userId/history
// Get monthly history for a specific user (Admin Access)
// ═══════════════════════════════════════════════
const getUserAttendanceHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const now = new Date();
        const month = parseInt(req.query.month) || now.getMonth() + 1;
        const year = parseInt(req.query.year) || now.getFullYear();

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        // Verify user exists
        const user = await User.findById(userId).select("fullName email");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const records = await Attendance.find({
            user: userId,
            date: { $gte: start, $lte: end },
        })
            .select("date status clockIn clockOut activeSeconds dailyReport")
            .sort({ date: 1 })
            .lean();

        const daysPresent = records.filter(
            (r) => ["clocked-in", "clocked-out", "away"].includes(r.status)
        ).length;

        const totalActiveSeconds = records.reduce(
            (sum, r) => sum + (r.activeSeconds || 0),
            0
        );

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email
                },
                month,
                year,
                records,
                stats: {
                    daysPresent,
                    totalWorkingHours: Math.round((totalActiveSeconds / 3600) * 10) / 10,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// POST /api/attendance/admin/:userId/override
// Override an attendance day to present or absent manually
// ═══════════════════════════════════════════════
const adminOverride = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { date, status } = req.body; // status = 'present' or 'absent', date = YYYY-MM-DD

        const [yyyy, mm, dd] = date.split('-');
        const start = new Date(Number(yyyy), Number(mm) - 1, Number(dd));

        let record = await Attendance.findOne({ user: userId, date: start });

        let activeSeconds = 0;
        if (status === 'present') {
            // Assume 8 hours manual override mapping
            activeSeconds = 28800;
        }

        if (!record) {
            record = new Attendance({
                user: userId,
                date: start,
                status: status === 'present' ? 'clocked-out' : 'absent',
                activeSeconds,
                clockIn: status === 'present' ? start : null,
                clockOut: status === 'present' ? new Date(start.getTime() + activeSeconds * 1000) : null,
                dailyReport: "Admin overridden."
            });
        } else {
            record.status = status === 'present' ? 'clocked-out' : 'absent';
            record.activeSeconds = activeSeconds;
            if (status === 'absent') {
                record.lastActiveAt = null;
                record.clockIn = null;
                record.clockOut = null;
                record.dailyReport = "Admin marked absent.";
            } else {
                if (!record.clockIn) record.clockIn = start;
                record.clockOut = new Date(start.getTime() + activeSeconds * 1000);
                record.dailyReport = "Admin overridden.";
            }
        }

        await record.save();

        res.status(200).json({
            success: true,
            message: `Attendance marked as ${status}.`
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    clockIn,
    goAway,
    resume,
    clockOut,
    getToday,
    getHistory,
    getAllUsersStatus,
    getUserAttendanceHistory,
    adminOverride,
};
