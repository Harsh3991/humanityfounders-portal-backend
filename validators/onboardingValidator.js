const { body } = require("express-validator");

// ─── Step 1: Financials & Identity Validation ───
const step1Validator = [
    body("bankName")
        .trim()
        .notEmpty()
        .withMessage("Bank name is required"),
    body("accountNumber")
        .trim()
        .notEmpty()
        .withMessage("Account number is required")
        .isLength({ min: 8, max: 18 })
        .withMessage("Account number must be between 8 and 18 digits"),
    body("ifscCode")
        .trim()
        .notEmpty()
        .withMessage("IFSC code is required")
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
        .withMessage("Invalid IFSC code format (e.g., SBIN0001234)"),
];

// ─── Step 2: Digital Declaration Validation ───
const step2Validator = [
    body("declarationAccepted")
        .isBoolean()
        .withMessage("Declaration must be accepted")
        .equals("true")
        .withMessage("You must accept the declaration to proceed"),
    body("digitalSignature")
        .trim()
        .notEmpty()
        .withMessage("Digital signature (full name) is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Signature must be between 2 and 100 characters"),
];

module.exports = {
    step1Validator,
    step2Validator,
};
