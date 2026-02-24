const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: ["CREATE_EMPLOYEE", "DELETE_EMPLOYEE", "ATTENDANCE_OVERRIDE", "UPDATE_EMPLOYEE"],
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        targetUser: {
            type: String, // Backup of Name/Email in case of deletion
        },
        targetUserId: {
            type: mongoose.Schema.Types.ObjectId, // Optional reference
            ref: "User",
        },
        details: {
            type: String,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed, // Flexible object for extra data
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
