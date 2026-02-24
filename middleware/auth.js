const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes — verifies JWT token from Authorization header
 * Attaches user object to req.user
 */
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for Bearer token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized — no token provided",
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database (exclude password)
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized — user not found",
            });
        }

        if (user.status === "inactive") {
            return res.status(401).json({
                success: false,
                message: "Account has been deactivated. Contact HR.",
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Not authorized — invalid token",
        });
    }
};

module.exports = protect;
