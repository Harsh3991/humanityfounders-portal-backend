const User = require("../models/User");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Attendance = require("../models/Attendance");
const AuditLog = require("../models/AuditLog");
const { getMonthRangeIST, getNowIST } = require("../utils/dateUtils");

// ═══════════════════════════════════════════════
// GET /api/users/:id/worklog
// Unified Employee Work Log — Every action, assignment, and record
// Access: Admin / HR Only
// ═══════════════════════════════════════════════
const getEmployeeWorklog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const nowIST = getNowIST();
        const month = parseInt(req.query.month) || nowIST.month;
        const year = parseInt(req.query.year) || nowIST.year;

        // Verify user exists
        const user = await User.findById(id).select("fullName email role department status startDate createdAt");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Date range for attendance (IST-aware month boundaries)
        const { start: monthStart, end: monthEnd } = getMonthRangeIST(month, year);

        // ─── Parallel fetch all data sources ───
        // Determine which projects to show by looking ONLY at current task assignments.
        // We deliberately avoid Project.members because it is an append-only set that
        // never removes a person when they are unassigned from a task — this would
        // cause "ghost" project entries in the worklog for people who were once assigned
        // but have since been removed from all tasks in that project.
        const employeeTasks = await Task.find({ assignees: id }).select("project").lean();
        const taskProjectIds = [...new Set(employeeTasks.map((t) => t.project?.toString()).filter(Boolean))];

        const [rawProjects, tasks, attendanceRecords, auditLogs] = await Promise.all([
            // 1. Projects where the employee CURRENTLY has at least one task assigned.
            //    (task-assignee list is always up-to-date; Project.members is not)
            Project.find({ _id: { $in: taskProjectIds } })
                .select("name description status createdAt")
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

        // ─── Compute unique task-assignee count per project ───
        // Fetch all tasks for each relevant project (to count unique assignees)
        const projectIds = rawProjects.map((p) => p._id);
        const allProjectTasks = await Task.find({ project: { $in: projectIds } })
            .select("project assignees")
            .lean();

        // Collect every unique assignee ID referenced across all project tasks
        const allRawAssigneeIds = new Set();
        allProjectTasks.forEach((t) => {
            (t.assignees || []).forEach((a) => allRawAssigneeIds.add(a.toString()));
        });

        // Verify which of those IDs still exist as active users in the DB.
        // This removes ghost references left by deleted user accounts.
        const existingUsers = await User.find({
            _id: { $in: [...allRawAssigneeIds] },
        }).select("_id").lean();
        const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

        // Build a map: projectId → Set of *existing* unique assignee IDs
        const assigneeMap = {};
        allProjectTasks.forEach((t) => {
            const pid = t.project?.toString();
            if (!pid) return;
            if (!assigneeMap[pid]) assigneeMap[pid] = new Set();
            (t.assignees || []).forEach((a) => {
                const aid = a.toString();
                if (existingUserIds.has(aid)) assigneeMap[pid].add(aid);
            });
        });

        // Attach assignedMemberCount to each project (no members/deadline exposure)
        const projects = rawProjects.map((p) => ({
            _id: p._id,
            name: p.name,
            description: p.description,
            status: p.status,
            createdAt: p.createdAt,
            assignedMemberCount: (assigneeMap[p._id.toString()] || new Set()).size,
        }));

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
