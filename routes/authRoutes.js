const express = require("express");
const router = express.Router();
const { login, register, getMe } = require("../controllers/authController");
const { loginValidator, registerValidator } = require("../validators/authValidator");
const validate = require("../middleware/validate");
const protect = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");
const { ROLES } = require("../utils/constants");

// ─── Public Routes ───
router.post("/login", loginValidator, validate, login);

// ─── Protected Routes ───
router.post(
    "/register",
    protect,
    roleAuth(ROLES.ADMIN, ROLES.HR),
    registerValidator,
    validate,
    register
);

router.get("/me", protect, getMe);

module.exports = router;
