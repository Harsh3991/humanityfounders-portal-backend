const express = require("express");
const router = express.Router();
const {
    clockIn,
    goAway,
    resume,
    clockOut,
    getToday,
    getHistory,
    getAllUsersStatus,
    getUserAttendanceHistory,
    adminOverride
} = require("../controllers/attendanceController");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");

// All attendance routes require authentication
router.use(protect);

// ─── Admin / HR Routes ───
// Get everyone's status (for Directory/Dashboard)
router.get("/admin/status", roleAuth("admin", "hr", "manager"), getAllUsersStatus);

// Get specific user history
router.get("/admin/:userId/history", roleAuth("admin", "hr", "manager"), getUserAttendanceHistory);

// Override an attendance day
router.post("/admin/:userId/override", roleAuth("admin", "hr", "manager"), adminOverride);

// ─── Personal Routes ───
// Today's status
router.get("/today", getToday);

// Monthly history
router.get("/history", getHistory);

// Clock actions
router.post("/clock-in", clockIn);
router.post("/away", goAway);
router.post("/resume", resume);
router.post("/clock-out", clockOut);

module.exports = router;
