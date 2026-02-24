const express = require("express");
const router = express.Router();
const { getDashboard } = require("../controllers/dashboardController");
const protect = require("../middleware/auth");

// All dashboard routes require authentication
router.use(protect);

// GET /api/dashboard — role-based dashboard data
router.get("/", getDashboard);

module.exports = router;
