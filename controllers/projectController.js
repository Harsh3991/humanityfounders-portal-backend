const Project = require("../models/Project");
const Task = require("../models/Task");
const { ROLES } = require("../utils/constants");

// ─────────────────────────────────────────────────
// POST /api/projects
// Create a new project (Admin only)
// ─────────────────────────────────────────────────
const createProject = async (req, res, next) => {
    try {
        const { name, description, members, deadline } = req.body;

        const project = await Project.create({
            name,
            description,
            members: members || [],
            deadline,
            createdBy: req.user._id,
        });

        // Add project initialization task
        const initialTask = await Task.create({
            name: "Project Initialization",
            description: "Set up the initial requirements and structure for the project.",
            project: project._id,
            assignees: [req.user._id],
            createdBy: req.user._id,
            status: "in-progress",
            priority: "medium",
        });

        // Populate members for response
        await project.populate("members", "fullName email department role");
        await project.populate("createdBy", "fullName email");

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/projects
// Get all projects (Admin: all, Employee: only theirs)
// PRD 5.3: Employees see only their projects; Admins see all
// ─────────────────────────────────────────────────
const getAllProjects = async (req, res, next) => {
    try {
        let filter = {};

        // Employees see projects they are a member of OR assigned to any task in
        if (req.user.role === ROLES.EMPLOYEE) {
            // Find project IDs where this user is assigned to any task (safety net)
            const assignedProjectIds = await Task.distinct("project", {
                assignees: req.user._id,
            });

            filter = {
                $or: [
                    { members: req.user._id },
                    { _id: { $in: assignedProjectIds } },
                ],
            };
        }

        // Optional status filter
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const projects = await Project.find(filter)
            .populate("members", "fullName email department role")
            .populate("createdBy", "fullName email")
            .sort({ createdAt: -1 })
            .lean();

        const projectIds = projects.map(p => p._id);

        // 🚀 Run task stats aggregation in parallel — no need to wait sequentially
        const taskStats = projectIds.length > 0
            ? await Task.aggregate([
                { $match: { project: { $in: projectIds } } },
                {
                    $group: {
                        _id: "$project",
                        totalTasks: { $sum: 1 },
                        completedTasks: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }
                    }
                }
            ])
            : [];

        // Map for fast O(1) lookups
        const statsMap = {};
        taskStats.forEach(stat => {
            statsMap[stat._id.toString()] = {
                taskCount: stat.totalTasks,
                completedCount: stat.completedTasks
            };
        });

        // Attach task counts synchronously
        const projectsWithCounts = projects.map(project => {
            const stats = statsMap[project._id.toString()] || { taskCount: 0, completedCount: 0 };
            return {
                ...project,
                taskCount: stats.taskCount,
                completedCount: stats.completedCount
            };
        });

        res.status(200).json({
            success: true,
            count: projectsWithCounts.length,
            data: projectsWithCounts,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// GET /api/projects/:id
// Get a single project by ID
// ─────────────────────────────────────────────────
const getProjectById = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("members", "fullName email department role")
            .populate("createdBy", "fullName email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Employees can only view projects they belong to or have tasks assigned in
        if (req.user.role === ROLES.EMPLOYEE) {
            const isMember = project.members.some(
                (m) => m._id.toString() === req.user._id.toString()
            );

            if (!isMember) {
                // Check if the employee is assigned to any task in this project
                const assignedTaskCount = await Task.countDocuments({
                    project: project._id,
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

        res.status(200).json({
            success: true,
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// PUT /api/projects/:id
// Update project details (Admin only)
// ─────────────────────────────────────────────────
const updateProject = async (req, res, next) => {
    try {
        const { name, description, status, deadline } = req.body;

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { name, description, status, deadline },
            { new: true, runValidators: true }
        )
            .populate("members", "fullName email department role")
            .populate("createdBy", "fullName email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// PUT /api/projects/:id/members
// Add members to a project (Admin only)
// ─────────────────────────────────────────────────
const addMembers = async (req, res, next) => {
    try {
        const { members } = req.body; // Array of user IDs

        if (!members || !Array.isArray(members)) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of member IDs",
            });
        }

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { members: { $each: members } } }, // $addToSet prevents duplicates
            { new: true }
        )
            .populate("members", "fullName email department role")
            .populate("createdBy", "fullName email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Members added successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// DELETE /api/projects/:id/members
// Remove a member from a project (Admin only)
// ─────────────────────────────────────────────────
const removeMember = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Please provide a userId to remove",
            });
        }

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { $pull: { members: userId } },
            { new: true }
        )
            .populate("members", "fullName email department role")
            .populate("createdBy", "fullName email");

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Member removed successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────
// DELETE /api/projects/:id
// Delete a project and all its tasks
// Admin can delete any project; creator can delete their own
// ─────────────────────────────────────────────────
const deleteProject = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        // Only admin OR the creator can delete the project
        const isAdmin = req.user.role === ROLES.ADMIN;
        const isCreator = project.createdBy.toString() === req.user._id.toString();

        if (!isAdmin && !isCreator) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Only the project creator or an admin can delete this project.",
            });
        }

        // Delete all tasks associated with this project
        await Task.deleteMany({ project: project._id });

        // Delete the project itself
        await Project.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Project and associated tasks deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    addMembers,
    removeMember,
    deleteProject,
};
