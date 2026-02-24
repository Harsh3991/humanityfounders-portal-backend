const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        date: {
            type: Date,
            required: true,
        },

        // Latest Clock In/Out times for reference
        clockIn: { type: Date },
        clockOut: { type: Date },

        // Status: clocked-in, clocked-out, away, absent
        status: {
            type: String,
            enum: ["clocked-in", "clocked-out", "away", "absent"],
            default: "absent",
        },

        // Total ACTIVE working time in seconds (sum of all sessions)
        activeSeconds: { type: Number, default: 0 },

        // Timestamp when the current active segment started
        // (reset on clock-in and resume; used to calculate active time)
        lastActiveAt: { type: Date },

        // History of work sessions (Clock In -> Clock Out)
        sessions: [
            {
                start: { type: Date, required: true },
                end: { type: Date },
                duration: { type: Number, default: 0 }, // seconds
            },
        ],

        // Break (away) tracking
        breaks: [
            {
                start: { type: Date, required: true },
                end: { type: Date },
                duration: { type: Number, default: 0 }, // seconds
            },
        ],

        // Daily report (append new reports if multiple sessions)
        dailyReport: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: one attendance record per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;
