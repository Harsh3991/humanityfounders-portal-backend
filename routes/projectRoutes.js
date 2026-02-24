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
router.get("/:id", getProjectById);                          // All users (access checked in controller)
router.post("/", roleAuth("admin"), createProject);          // Admin only
router.put("/:id", roleAuth("admin"), updateProject);        // Admin only
router.delete("/:id", roleAuth("admin"), deleteProject);     // Admin only

// ─── Member Management ───
router.put("/:id/members", roleAuth("admin"), addMembers);         // Admin only
router.delete("/:id/members", roleAuth("admin"), removeMember);    // Admin only

module.exports = router;
