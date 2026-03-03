const express = require("express");
const router = express.Router();
const {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    addMembers,
    removeMember,
    deleteProject,
} = require("../controllers/projectController");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");

// ─── All routes require authentication ───
router.use(protect);

// ─── Project CRUD ───
router.get("/", getAllProjects);                              // All users (filtered by role)
router.post("/", roleAuth("admin", "manager", "employee"), createProject); // Admin, Manager, Employee
router.put("/:id", roleAuth("admin"), updateProject);        // Admin only
router.delete("/:id", deleteProject);                        // Admin or project creator

// ─── Member Management ───
router.put("/:id/members", roleAuth("admin"), addMembers);         // Admin only
router.delete("/:id/members", roleAuth("admin"), removeMember);    // Admin only

module.exports = router;
