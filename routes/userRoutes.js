const express = require("express");
const router = express.Router();
const {
    getAllEmployees,
    getEmployeeById,
    updateEmployeeProfile,
    deleteEmployee,
    getEmployeeDocument,
} = require("../controllers/userController");
const { getEmployeeWorklog } = require("../controllers/worklogController");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");

// ─── Protected Routes ───
// All routes here require authentication
router.use(protect);

// ─── Directory (HR & Admin) ───
router.get("/", roleAuth("admin", "hr"), getAllEmployees);
router.get("/:id", roleAuth("admin", "hr"), getEmployeeById);
router.get("/:id/worklog", roleAuth("admin", "hr"), getEmployeeWorklog);
router.get("/:id/document/:docType", roleAuth("admin", "hr"), getEmployeeDocument);

// ─── Management (HR & Admin) ───
router.put("/:id", roleAuth("admin", "hr"), updateEmployeeProfile);
router.delete("/:id", roleAuth("admin", "hr"), deleteEmployee);

module.exports = router;
