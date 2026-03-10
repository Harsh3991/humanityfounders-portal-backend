const Task = require("../models/Task");
const Project = require("../models/Project");
const { ROLES } = require("../utils/constants");
const { sendOverdueTaskEmail } = require("../utils/emailService");

// ─────────────────────────────────────────────────
// POST /api/tasks
// Create a new task (any project member can create)
// PRD: Create Task available to all users
// ─────────────────────────────────────────────────
const createTask = async (req, res, next) => {
    try {
        const { name, description, project, assignees, dueDate, priority, parentTask } = req.body;

        // Verify the project exists
        const projectDoc = await Project.findById(project);
        if (!projectDoc) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Employees can only create tasks in projects they belong to or have tasks assigned in
        if (req.user.role === ROLES.EMPLOYEE) {
            const isMember = projectDoc.members.some(
                (m) => m.toString() === req.user._id.toString()
            );

            if (!isMember) {
                const assignedTaskCount = await Task.countDocuments({
                    project: projectDoc._id,
                    assignees: req.user._id,
                });

                if (assignedTaskCount === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "You are not a member of this project",
                    });
                }
            }
        }

        // If this is a subtask, verify the parent task exists and belongs to the same project
        if (parentTask) {
            const parent = await Task.findById(parentTask);
            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: "Parent task not found",
                });
            }
            if (parent.project.toString() !== project) {
                return res.status(400).json({
                    success: false,
                    message: "Parent task must belong to the same project",
                });
            }
        }

        const task = await Task.create({
            name,
            description,
            project,
            assignees: assignees || [],
            dueDate,
            priority: priority || "none",
            parentTask: parentTask || null,
            createdBy: req.user._id,
        });

        // Auto-add assignees to the project's members list so they can see the project
        if (assignees && assignees.length > 0) {
            await Project.findByIdAndUpdate(project, {
                $addToSet: { members: { $each: assignees } },
            });
        }

        await task.populate("assignees", "fullName email department status");
        await task.populate("createdBy", "fullName email");
        await task.populate("project", "name");

        if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done") {
            task.overdueEmailSent = true;
            await Task.findByIdAndUpdate(task._id, { overdueEmailSent: true });
            for (const assignee of task.assignees) {
                if (assignee.status === "active") {
                    sendOverdueTaskEmail(assignee.email, assignee.fullName, task.name, task.dueDate).catch(err => console.error("Immediate overdue email err:", err));
                }
            }
        }

        res.status(201).json({
            success: true,
            message: parentTask ? "Sub-task created successfully" : "Task created successfully",
            data: task,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/tasks/project/:projectId
// Get all tasks for a specific project
// ─────────────────────────────────────────────────
const getTasksByProject = async (req, res, next) => {
    try {
        const { projectId } = req.params;

        // Verify project access — lean query, only fetch members field for the check
        const project = await Project.findById(projectId).select("members").lean();
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Employees can only view tasks in their projects or projects they have tasks in
        if (req.user.role === ROLES.EMPLOYEE) {
            const isMember = project.members.some(
                (m) => m.toString() === req.user._id.toString()
            );

            if (!isMember) {
                const assignedTaskCount = await Task.countDocuments({
                    project: projectId,
                    assignees: req.user._id,
                });

                if (assignedTaskCount === 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Access denied. You are not a member of this project.",
                    });
                }
            }
        }

        // Optional filters
        const filter = { project: projectId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.priority) filter.priority = req.query.priority;
        if (req.query.assignee) filter.assignees = req.query.assignee;

        // Only get top-level tasks (not subtasks) by default
        if (req.query.topLevel !== "false") {
            filter.parentTask = null;
        }

        const tasks = await Task.find(filter)
            .populate("assignees", "fullName email department")
            .populate("createdBy", "fullName email")
            .sort({ dueDate: 1, priority: -1 })
            .lean();

        // When topLevel=false (flat list for tree building), skip subtask stats — they're not needed
        if (req.query.topLevel === "false") {
            return res.status(200).json({
                success: true,
                count: tasks.length,
                data: tasks,
            });
        }

        // Get subtask stats only for top-level view
        const taskIds = tasks.map((t) => t._id);

        const subtaskStats = taskIds.length > 0
            ? await Task.aggregate([
                { $match: { parentTask: { $in: taskIds } } },
                {
                    $group: {
                        _id: "$parentTask",
                        subtaskCount: { $sum: 1 },
                        subtaskDone: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
                    },
                },
            ])
            : [];

        const statsMap = {};
        subtaskStats.forEach((stat) => {
            statsMap[stat._id.toString()] = {
                subtaskCount: stat.subtaskCount,
                subtaskDone: stat.subtaskDone,
            };
        });

        const tasksWithSubCount = tasks.map((task) => {
            const stats = statsMap[task._id.toString()] || { subtaskCount: 0, subtaskDone: 0 };
            return {
                ...task,
                subtaskCount: stats.subtaskCount,
                subtaskDone: stats.subtaskDone,
            };
        });

        res.status(200).json({
            success: true,
            count: tasksWithSubCount.length,
            data: tasksWithSubCount,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/tasks/:id
// Get a single task by ID (with subtasks)
// ─────────────────────────────────────────────────
const getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate("assignees", "fullName email department")
            .populate("createdBy", "fullName email")
            .populate("project", "name");

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found",
            });
        }

        // Get subtasks
        const subtasks = await Task.find({ parentTask: task._id })
            .populate("assignees", "fullName email department")
            .sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            data: {
                ...task.toObject(),
                subtasks,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// PUT /api/tasks/:id
// Update a task (details or status change)
// PRD Workflow: To Do -> In Progress -> Review -> Done
// ─────────────────────────────────────────────────
const updateTask = async (req, res, next) => {
    try {
        const { name, description, assignees, dueDate, priority, status, deadlineExtended } = req.body;

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found",
            });
        }

        // Update fields
        if (name !== undefined) task.name = name;
        if (description !== undefined) task.description = description;
        if (assignees !== undefined) task.assignees = assignees;
        if (deadlineExtended !== undefined) task.deadlineExtended = deadlineExtended;
        if (dueDate !== undefined) {
            if (task.dueDate && new Date(dueDate) > new Date(task.dueDate)) {
                task.deadlineExtended = true;
            }
            task.dueDate = dueDate;
            if (new Date(dueDate) >= new Date()) {
                task.overdueEmailSent = false;
            }
        }
        if (priority !== undefined) task.priority = priority;

        // Status workflow validation
        if (status !== undefined && status !== task.status) {
            const workflow = ["todo", "in-progress", "review", "done"];
            const currentIndex = workflow.indexOf(task.status);
            const newIndex = workflow.indexOf(status);

            // Allow moving forward or backward in the workflow
            if (newIndex === -1) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${workflow.join(", ")}`,
                });
            }

            task.status = status;

            // Track completion time
            if (status === "done") {
                task.completedAt = new Date();
            } else {
                task.completedAt = null;
            }
        }

        await task.save();

        // Auto-add new assignees to the project's members list so they can see the project
        if (assignees !== undefined && assignees.length > 0) {
            await Project.findByIdAndUpdate(task.project, {
                $addToSet: { members: { $each: assignees } },
            });
        }

        await task.populate("assignees", "fullName email department status");
        await task.populate("createdBy", "fullName email");
        await task.populate("project", "name");

        if (task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && !task.overdueEmailSent) {
            task.overdueEmailSent = true;
            await Task.findByIdAndUpdate(task._id, { overdueEmailSent: true });
            for (const assignee of task.assignees) {
                if (assignee.status === "active") {
                    sendOverdueTaskEmail(assignee.email, assignee.fullName, task.name, task.dueDate).catch(err => console.error("Immediate overdue email err:", err));
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: task,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/tasks/my-tasks
// Get all tasks assigned to the logged-in user
// PRD 5.2: Dashboard "My Tasks" — filter by user across all projects
// ─────────────────────────────────────────────────
const getMyTasks = async (req, res, next) => {
    try {
        const filter = { assignees: req.user._id };

        // Optional status filter
        if (req.query.status) filter.status = req.query.status;

        const tasks = await Task.find(filter)
            .populate("project", "name")
            .populate("createdBy", "fullName email")
            .sort({ dueDate: 1 })
            .lean();

        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/tasks/user/:userId
// Get all tasks assigned to a specific user (Admin only)
// PRD 5.4: Admin Task Oversight — grouped by project
// ─────────────────────────────────────────────────
const getTasksByUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const tasks = await Task.find({ assignees: userId })
            .populate("project", "name status")
            .sort({ dueDate: 1 })
            .lean();

        // Group tasks by project (for Task Oversight view)
        const grouped = {};
        tasks.forEach((task) => {
            const projectName = task.project?.name || "Unassigned";
            const projectId = task.project?._id?.toString() || "none";
            if (!grouped[projectId]) {
                grouped[projectId] = {
                    projectName,
                    projectId,
                    tasks: [],
                };
            }
            grouped[projectId].tasks.push(task);
        });

        res.status(200).json({
            success: true,
            count: tasks.length,
            data: Object.values(grouped),
        });
    } catch (error) {
        next(error);
    }
};

// Helper to recursively delete tasks and all their subtask children
const deleteTasksRecursively = async (taskIds) => {
    if (!taskIds || taskIds.length === 0) return;

    // Find all immediate subtasks of these tasks
    const subtasks = await Task.find({ parentTask: { $in: taskIds } }).select("_id");
    const subtaskIds = subtasks.map((s) => s._id);

    // If there ARE subtasks, recursively delete them first
    if (subtaskIds.length > 0) {
        await deleteTasksRecursively(subtaskIds);
    }

    // Finally delete the current batch of tasks
    await Task.deleteMany({ _id: { $in: taskIds } });
};

// ─────────────────────────────────────────────────
// DELETE /api/tasks/:id
// Delete a task and all its subtasks (recursively)
// ─────────────────────────────────────────────────
const deleteTask = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found",
            });
        }

        // Use our recursive helper to delete the task and everything under it
        await deleteTasksRecursively([task._id]);

        res.status(200).json({
            success: true,
            message: "Task and all subtasks deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasksByProject,
    getTaskById,
    updateTask,
    getMyTasks,
    getTasksByUser,
    deleteTask,
};
