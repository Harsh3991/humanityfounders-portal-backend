const { validationResult } = require("express-validator");

/**
 * Middleware to check validation results from express-validator
 * If there are errors, return 400 with the error messages
 * If no errors, continue to next middleware/controller
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array().map((err) => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }

    next();
};

module.exports = validate;
