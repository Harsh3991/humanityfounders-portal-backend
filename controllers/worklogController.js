const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Attendance = require("../models/Attendance");
const AuditLog = require("../models/AuditLog");

// ═══════════════════════════════════════════════
// GET /api/users/:id/worklog
// Unified Employee Work Log — Every action, assignment, and record
// Access: Admin / HR Only
// ═══════════════════════════════════════════════
const getEmployeeWorklog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const now = new Date();
        const month = parseInt(req.query.month) || now.getMonth() + 1;
        const year = parseInt(req.query.year) || now.getFullYear();

        // Verify user exists
        const user = await User.findById(id).select("fullName email role department status startDate createdAt");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Date range for attendance (specific month)
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        // ─── Parallel fetch all data sources ───
        const [projects, tasks, attendanceRecords, auditLogs] = await Promise.all([
            // 1. Projects the employee is a member of
            Project.find({ members: id })
                .select("name description status deadline members createdAt")
                .populate("members", "fullName email")
                .populate("createdBy", "fullName email")
                .sort({ createdAt: -1 })
                .lean(),

            // 2. Tasks assigned to the employee
            Task.find({ assignees: id })
                .select("name description status priority dueDate project completedAt createdAt updatedAt")
                .populate("project", "name status")
                .populate("assignees", "fullName email")
                .populate("createdBy", "fullName email")
                .sort({ updatedAt: -1 })
                .lean(),

            // 3. All attendance records for the selected month
            Attendance.find({
                user: id,
                date: { $gte: monthStart, $lte: monthEnd },
            })
                .select("date status clockIn clockOut activeSeconds sessions breaks dailyReport createdAt updatedAt")
                .sort({ date: -1 })
                .lean(),

            // 4. All audit logs where this employee is the target OR performer
            AuditLog.find({
                $or: [
                    { targetUserId: id },
                    { performedBy: id },
                ],
            })
                .populate("performedBy", "fullName email role")
                .sort({ createdAt: -1 })
                .limit(200)
                .lean(),
        ]);

        // ─── Compute Attendance Stats ───
        const daysPresent = attendanceRecords.filter(
            (r) => ["clocked-in", "clocked-out", "away"].includes(r.status)
        ).length;

        const totalActiveSeconds = attendanceRecords.reduce(
            (sum, r) => sum + (r.activeSeconds || 0),
            0
        );

        const totalSessions = attendanceRecords.reduce(
            (sum, r) => sum + (r.sessions?.length || 0),
            0
        );

        const totalBreaks = attendanceRecords.reduce(
            (sum, r) => sum + (r.breaks?.length || 0),
            0
        );

        // ─── Build unified timeline entries ───
        const timeline = [];

        // Add attendance events to timeline
        attendanceRecords.forEach((record) => {
            // Each session is a clock-in/clock-out pair
            if (record.sessions && record.sessions.length > 0) {
                record.sessions.forEach((session, idx) => {
                    timeline.push({
                        type: "clock_in",
                        timestamp: session.start,
                        date: record.date,
                        details: `Session ${idx + 1} started`,
                        meta: { sessionIndex: idx + 1 },
                    });
                    if (session.end) {
                        const durationMins = Math.round((session.duration || 0) / 60);
                        timeline.push({
                            type: "clock_out",
                            timestamp: session.end,
                            date: record.date,
                            details: `Session ${idx + 1} ended (${durationMins} min)`,
                            meta: { sessionIndex: idx + 1, durationMinutes: durationMins },
                        });
                    }
                });
            }

            // Add breaks to timeline
            if (record.breaks && record.breaks.length > 0) {
                record.breaks.forEach((brk, idx) => {
                    timeline.push({
                        type: "break_start",
                        timestamp: brk.start,
                        date: record.date,
                        details: `Break ${idx + 1} started`,
                        meta: { breakIndex: idx + 1 },
                    });
                    if (brk.end) {
                        const breakMins = Math.round((brk.duration || 0) / 60);
                        timeline.push({
                            type: "break_end",
                            timestamp: brk.end,
                            date: record.date,
                            details: `Break ${idx + 1} ended (${breakMins} min)`,
                            meta: { breakIndex: idx + 1, durationMinutes: breakMins },
                        });
                    }
                });
            }

            // Add daily report to timeline
            if (record.dailyReport && record.dailyReport.trim()) {
                timeline.push({
                    type: "daily_report",
                    timestamp: record.updatedAt || record.createdAt,
                    date: record.date,
                    details: record.dailyReport,
                    meta: {},
                });
            }
        });

        // Add audit log events to timeline
        auditLogs.forEach((log) => {
            timeline.push({
                type: "audit",
                timestamp: log.createdAt,
                details: log.details || log.action,
                meta: {
                    action: log.action,
                    performedBy: log.performedBy?.fullName || "System",
                    performedByEmail: log.performedBy?.email || "",
                    targetUser: log.targetUser || "",
                },
            });
        });

        // Add task status events to timeline
        tasks.forEach((task) => {
            timeline.push({
                type: "task_assigned",
                timestamp: task.createdAt,
                details: `Assigned to task: "${task.name}"`,
                meta: {
                    taskId: task._id,
                    taskName: task.name,
                    projectName: task.project?.name || "Unknown Project",
                    status: task.status,
                    priority: task.priority,
                    createdBy: task.createdBy?.fullName || "Unknown",
                },
            });

            if (task.completedAt) {
                timeline.push({
                    type: "task_completed",
                    timestamp: task.completedAt,
                    details: `Completed task: "${task.name}"`,
                    meta: {
                        taskId: task._id,
                        taskName: task.name,
                        projectName: task.project?.name || "Unknown Project",
                    },
                });
            }
        });

        // Sort timeline by timestamp descending (newest first)
        timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // ─── Response ───
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                    status: user.status,
                    startDate: user.startDate,
                    createdAt: user.createdAt,
                },
                month,
                year,
                summary: {
                    totalProjects: projects.length,
                    totalTasks: tasks.length,
                    tasksByStatus: {
                        todo: tasks.filter((t) => t.status === "todo").length,
                        inProgress: tasks.filter((t) => t.status === "in-progress").length,
                        review: tasks.filter((t) => t.status === "review").length,
                        done: tasks.filter((t) => t.status === "done").length,
                    },
                    attendance: {
                        daysPresent,
                        totalWorkingHours: Math.round((totalActiveSeconds / 3600) * 10) / 10,
                        totalSessions,
                        totalBreaks,
                    },
                    totalAuditEvents: auditLogs.length,
                },
                projects,
                tasks,
                attendance: attendanceRecords,
                auditLogs,
                timeline,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getEmployeeWorklog,
};
