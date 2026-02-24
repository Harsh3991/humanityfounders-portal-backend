const express = require("express");
const router = express.Router();
const {
    createTask,
    getTasksByProject,
    getTaskById,
    updateTask,
    getMyTasks,
    getTasksByUser,
    deleteTask,
} = require("../controllers/taskController");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");

// ─── All routes require authentication ───
router.use(protect);

// ─── Personal Tasks (Dashboard) ───
router.get("/my-tasks", getMyTasks);                          // Any logged-in user

// ─── Admin: Task Oversight (PRD 5.4) ───
router.get("/user/:userId", roleAuth("admin"), getTasksByUser); // Admin only

// ─── Task CRUD ───
router.post("/", createTask);                                 // Any project member
router.get("/project/:projectId", getTasksByProject);         // Any project member
router.get("/:id", getTaskById);                              // Any logged-in user
router.put("/:id", updateTask);                               // Any logged-in user
router.delete("/:id", deleteTask);                            // Any logged-in user

module.exports = router;
