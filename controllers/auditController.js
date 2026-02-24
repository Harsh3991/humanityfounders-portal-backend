const AuditLog = require("../models/AuditLog");

/**
 * GET /api/audit
 * Access: Admin Only
 * Retrieve recent audit logs to track system changes
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find()
            .populate("performedBy", "fullName email role")
            .sort({ createdAt: -1 })
            .limit(100);

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Internal Helper: Log diverse administrative actions
 * Not an API route, but a utility for other controllers
 */
const logAction = async ({ action, performedBy, targetUser, targetUserId, details }) => {
    try {
        await AuditLog.create({
            action,
            performedBy,
            targetUser,     // Name/Email string
            targetUserId,   // ObjectId
            details,
        });
    } catch (error) {
        console.error("❌ Audit Logging Failed:", error);
        // We log error but don't throw, to avoid breaking the main operation
    }
};

module.exports = {
    getAuditLogs,
    logAction,
};
