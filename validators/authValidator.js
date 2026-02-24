const { body } = require("express-validator");
const { ROLES, DEPARTMENTS } = require("../utils/constants");

// ─── Login Validation ───
const loginValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please enter a valid email"),
    body("password")
        .notEmpty()
        .withMessage("Password is required"),
];

// ─── Register Validation (Admin/HR creating a new user) ───
const registerValidator = [
    body("fullName")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Full name must be between 2 and 100 characters"),
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please enter a valid email"),
    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),
    body("role")
        .notEmpty()
        .withMessage("Role is required")
        .isIn([ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE])
        .withMessage("Role must be hr, manager, or employee"),
    body("department")
        .notEmpty()
        .withMessage("Department is required")
        .isIn(DEPARTMENTS)
        .withMessage("Invalid department"),
];

module.exports = {
    loginValidator,
    registerValidator,
};
