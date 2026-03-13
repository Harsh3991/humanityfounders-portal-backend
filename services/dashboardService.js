const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Task = require("../models/Task");
const Project = require("../models/Project");
const { ROLES, USER_STATUS } = require("../utils/constants");

const { getTodayRangeIST, getMonthRangeIST, deduplicateByISTDay } = require("../utils/dateUtils");

/**
 * Get the start and end of the current month
 */
const getMonthRange = () => {
    return getMonthRangeIST();
};

/**
 * Get today's date range (start of day to end of day)
 */
const getTodayRange = () => {
    return getTodayRangeIST();
};

/**
 * Get Employee Dashboard Data
 * PRD 5.2A: Welcome header, attendance widget, tasks, monthly stats, active projects
 */
const getEmployeeDashboard = async (userId) => {
    const { start: monthStart, end: monthEnd } = getMonthRange();
    const { start: todayStart, end: todayEnd } = getTodayRange();

    // Fetch user details first so we know their role
    const userObj = await User.findById(userId).select("fullName email role department status");

    const projectQuery = { status: "active" };
    // If regular employee or manager, only show projects where they have a task assigned.
    // Admin/HR see all active projects.
    if (userObj.role !== "admin" && userObj.role !== "hr") {
        const assignedProjectIds = await Task.distinct("project", { assignees: userId });
        projectQuery._id = { $in: assignedProjectIds };
    }

    // Run remaining queries in parallel for performance
    const [todayAttendance, monthlyAttendance, myTasks, myProjects] =
        await Promise.all([
            // Today's attendance record
            Attendance.findOne({
                user: userId,
                date: { $gte: todayStart, $lte: todayEnd },
            }),

            // Monthly attendance records
            Attendance.find({
                user: userId,
                date: { $gte: monthStart, $lte: monthEnd },
            }).select("date status activeSeconds"),

            // Tasks assigned to user (not done), sorted by due date
            Task.find({
                assignees: userId,
                status: { $ne: "done" },
            })
                .populate("project", "name")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean(),

            // Active projects based on role
            Project.find(projectQuery)
                .select("name status deadline")
                .lean(),
        ]);

    const user = userObj;

    // Calculate monthly stats
    const dedupedMonthly = deduplicateByISTDay(monthlyAttendance);
    const daysPresent = dedupedMonthly.filter(
        (a) => a.status === "clocked-out" || a.status === "clocked-in"
    ).length;
    const daysAbsent = dedupedMonthly.filter(
        (a) => a.status === "absent"
    ).length;
    const totalWorkingSeconds = dedupedMonthly.reduce(
        (sum, a) => sum + (a.activeSeconds || 0),
        0
    );

    // Format tasks with overdue flag
    // A task is overdue only once its due date's IST day has fully passed.
    // Compare against start-of-today IST so tasks due today are NOT shown as overdue.
    const { start: todayStartIST } = getTodayRangeIST();
    const formattedTasks = myTasks.map((task) => ({
        _id: task._id,
        name: task.name,
        projectName: task.project?.name || "No Project",
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        isOverdue: task.dueDate && new Date(task.dueDate) < todayStartIST,
    }));

    return {
        user: {
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            department: user.department,
        },
        attendance: {
            today: todayAttendance
                ? {
                    status: todayAttendance.status,
                    clockIn: todayAttendance.clockIn,
                    clockOut: todayAttendance.clockOut,
                    activeSeconds: todayAttendance.activeSeconds,
                    lastActiveAt: todayAttendance.lastActiveAt,
                }
                : { status: "not-started" },
        },
        monthlyStats: {
            daysPresent,
            daysAbsent,
            totalWorkingHours: Math.round((totalWorkingSeconds / 3600) * 10) / 10,
            totalRecords: monthlyAttendance.length,
        },
        tasks: formattedTasks,
        activeProjects: myProjects,
    };
};

/**
 * Get Management Dashboard Data (Manager/HR/Admin)
 * PRD 5.2B: Personal widgets + team overview + resource availability
 */
const getManagementDashboard = async (userId, userRole) => {
    // Get personal dashboard data first
    const personalData = await getEmployeeDashboard(userId);

    const { start: todayStart, end: todayEnd } = getTodayRange();

    // Build team query based on role
    let teamQuery = { status: USER_STATUS.ACTIVE };

    // Managers see their department, HR/Admin see everyone
    if (userRole === ROLES.MANAGER) {
        const currentUser = await User.findById(userId).select("department");
        teamQuery.department = currentUser.department;
    }

    // Run management-specific queries in parallel
    const [allActiveUsers, todayAttendanceRecords, usersWithNoTasks] =
        await Promise.all([
            // Total active employees
            User.find(teamQuery)
                .select("fullName email department role")
                .lean(),

            // Today's attendance for all employees
            Attendance.find({
                date: { $gte: todayStart, $lte: todayEnd },
                status: "clocked-in",
            })
                .populate("user", "fullName department")
                .lean(),

            // Employees with zero active tasks (Resource Availability)
            (async () => {
                const activeTaskAssignees = await Task.distinct('assignees', { status: { $ne: 'done' } });
                return User.find({ ...teamQuery, _id: { $nin: activeTaskAssignees } })
                    .select("fullName email department role")
                    .limit(20)
                    .lean();
            })()
        ]);

    return {
        ...personalData,
        teamOverview: {
            totalEmployees: allActiveUsers.length,
            onDutyCount: todayAttendanceRecords.length,
            onDutyEmployees: todayAttendanceRecords.map((a) => ({
                fullName: a.user?.fullName,
                department: a.user?.department,
            })),
        },
        resourceAvailability: usersWithNoTasks.map((u) => ({
            _id: u._id,
            fullName: u.fullName,
            email: u.email,
            department: u.department,
            role: u.role,
        })),
    };
};

module.exports = {
    getEmployeeDashboard,
    getManagementDashboard,
};
