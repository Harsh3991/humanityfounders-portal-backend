const Task = require("../models/Task");
const Project = require("../models/Project");
const { ROLES } = require("../utils/constants");

// ─────────────────────────────────────────────────
// POST /api/tasks
// Create a new task (any project member can create)
// PRD: Create Task available to all users
// ─────────────────────────────────────────────────
const createTask = async (req, res, next) => {
    try {
        const { name, description, project, assignee, dueDate, priority, parentTask } = req.body;

        // Verify the project exists
        const projectDoc = await Project.findById(project);
        if (!projectDoc) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Employees can only create tasks in projects they belong to
        if (
            req.user.role === ROLES.EMPLOYEE &&
            !projectDoc.members.some((m) => m.toString() === req.user._id.toString())
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this project",
            });
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
            assignee,
            dueDate,
            priority: priority || "none",
            parentTask: parentTask || null,
            createdBy: req.user._id,
        });

        await task.populate("assignee", "fullName email department");
        await task.populate("createdBy", "fullName email");
        await task.populate("project", "name");

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

        // Verify project access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Employees can only view tasks in their projects
        if (
            req.user.role === ROLES.EMPLOYEE &&
            !project.members.some((m) => m.toString() === req.user._id.toString())
        ) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You are not a member of this project.",
            });
        }

        // Optional filters
        const filter = { project: projectId };
        if (req.query.status) filter.status = req.query.status;
        if (req.query.priority) filter.priority = req.query.priority;
        if (req.query.assignee) filter.assignee = req.query.assignee;

        // Only get top-level tasks (not subtasks) by default
        if (req.query.topLevel !== "false") {
            filter.parentTask = null;
        }

        const tasks = await Task.find(filter)
            .populate("assignee", "fullName email department")
            .populate("createdBy", "fullName email")
            .sort({ dueDate: 1, priority: -1 })
            .lean();

        // Fix N+1 Query: Get all subtask stats in a single DB query
        const taskIds = tasks.map((t) => t._id);

        const subtaskStats = await Task.aggregate([
            { $match: { parentTask: { $in: taskIds } } },
            {
                $group: {
                    _id: "$parentTask",
                    subtaskCount: { $sum: 1 },
                    subtaskDone: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
                },
            },
        ]);

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
            .populate("assignee", "fullName email department")
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
            .populate("assignee", "fullName email department")
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
        const { name, description, assignee, dueDate, priority, status } = req.body;

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
        if (assignee !== undefined) task.assignee = assignee;
        if (dueDate !== undefined) task.dueDate = dueDate;
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

        await task.populate("assignee", "fullName email department");
        await task.populate("createdBy", "fullName email");
        await task.populate("project", "name");

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
        const filter = { assignee: req.user._id, parentTask: null };

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

        const tasks = await Task.find({ assignee: userId, parentTask: null })
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

// ─────────────────────────────────────────────────
// DELETE /api/tasks/:id
// Delete a task and all its subtasks
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

        // Delete all subtasks first
        await Task.deleteMany({ parentTask: task._id });

        // Delete the task
        await Task.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Task and subtasks deleted successfully",
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
