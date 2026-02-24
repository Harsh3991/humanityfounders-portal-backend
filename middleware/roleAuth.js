/**
 * Role-based authorization middleware
 * Usage: roleAuth("admin", "hr") — only admin and hr can access
 *        roleAuth("admin")       — only admin can access
 *
 * Must be used AFTER the protect (auth) middleware
 */
const roleAuth = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized",
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
            });
        }

        next();
    };
};

module.exports = roleAuth;
