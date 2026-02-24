const express = require("express");
const router = express.Router();
const { getAuditLogs } = require("../controllers/auditController");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");

// ─── Protect All Routes ───
router.use(protect);
router.use(roleAuth("admin")); // Only Admins can view logs

router.get("/", getAuditLogs);

module.exports = router;
