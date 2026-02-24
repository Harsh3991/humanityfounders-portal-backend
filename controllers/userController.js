const User = require("../models/User");
const { USER_STATUS } = require("../utils/constants");
const { encrypt, decrypt, decryptBuffer } = require("../utils/encryptData");
const { logAction } = require("./auditController");

// ═══════════════════════════════════════════════
// GET /api/users
// Get all users (Admin/HR Only) - Searchable & Filterable
// ═══════════════════════════════════════════════
const getAllEmployees = async (req, res, next) => {
    try {
        const { search, department, status, role } = req.query;

        // Build Query
        let query = {};

        // Search by Name or Email
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        // Filter by Department
        if (department) {
            query.department = department;
        }

        // Filter by Status (e.g., active, pending)
        if (status) {
            query.status = status;
        }

        // Filter by Role
        if (role) {
            query.role = role;
        }

        // Execute Query — select only the fields needed for listing
        // (excludes heavy onboarding data like bank details, documents, etc.)
        const users = await User.find(query)
            .select("fullName email role department status phone startDate createdAt")
            .sort({ createdAt: -1 })
            .lean(); // lean() returns plain JS objects = much faster

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/users/:id
// Get single employee details (Admin/HR Only)
// ═══════════════════════════════════════════════
const getEmployeeById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Decrypt sensitive data for viewing
        const userData = user.toObject();
        if (userData.onboarding && userData.onboarding.accountNumber) {
            try {
                userData.onboarding.accountNumber = decrypt(userData.onboarding.accountNumber);
            } catch (err) {
                // Keep original if decryption fails (legacy data or key mismatch)
                console.error("Decryption failed for user:", user._id);
            }
        }

        // Don't send passwords/secrets
        delete userData.password;
        delete userData.refreshToken;
        delete userData.__v;

        // Strip heavy binary files from the profile fetch to keep JSON tiny and fast
        if (userData.onboarding) {
            if (userData.onboarding.aadhaarCard && userData.onboarding.aadhaarCard.data) {
                // Keep the meta fields like fileName so frontend knows it exists!
                delete userData.onboarding.aadhaarCard.data;
            }
            if (userData.onboarding.panCard && userData.onboarding.panCard.data) {
                delete userData.onboarding.panCard.data;
            }
        }

        res.status(200).json({
            success: true,
            data: userData,
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// PUT /api/users/:id
// Update employee profile (Admin/HR Only)
// Note: Sensitive fields like password/role/status should be handled carefully
// ═══════════════════════════════════════════════
const updateEmployeeProfile = async (req, res, next) => {
    try {
        const { fullName, email, phone, role, department, status, startDate, bankName, accountNumber, ifscCode } = req.body;

        // Find user
        let user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update fields
        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (role) user.role = role;
        if (department) user.department = department;
        if (status) user.status = status;
        if (startDate) user.startDate = startDate;

        // Update Financials (nested in onboarding object)
        if (bankName !== undefined) user.onboarding.bankName = bankName;

        // Encrypt Account Number if updated
        if (accountNumber !== undefined) {
            user.onboarding.accountNumber = encrypt(accountNumber);
        }

        if (ifscCode !== undefined) user.onboarding.ifscCode = ifscCode;

        await user.save();

        // Audit Log
        await logAction({
            action: "UPDATE_EMPLOYEE",
            performedBy: req.user._id,
            targetUserId: user._id,
            targetUser: user.email,
            details: `Updated info for ${user.fullName} (Department: ${user.department}, Role: ${user.role})`
        });

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// DELETE /api/users/:id
// Offboard/Delete employee (Admin Only)
// ═══════════════════════════════════════════════
const deleteEmployee = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent deleting oneself
        if (String(user._id) === String(req.user._id)) {
            return res.status(400).json({ success: false, message: "You cannot delete your own account" });
        }

        // Hard Delete or Soft Delete? PRD says "Revokes access immediately".
        // We will do a soft delete by setting status to 'inactive' OR hard delete.
        // PRD mentions "Delete" but also "Offboard". Let's support Hard Delete for now for cleanup,
        // but typically 'inactive' is safer. Let's start with Hard Delete as per "Delete" action.

        await user.deleteOne();

        // Audit Log
        await logAction({
            action: "DELETE_EMPLOYEE",
            performedBy: req.user._id,
            targetUserId: user._id,
            targetUser: user.email,
            details: `Deleted user ${user.fullName} (${user.role})`
        });

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

// ═══════════════════════════════════════════════
// GET /api/users/:id/document/:docType
// Stream onboarding document binaries directly (Admin/HR Only)
// ═══════════════════════════════════════════════
const getEmployeeDocument = async (req, res, next) => {
    try {
        const { id, docType } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const doc = user.onboarding?.[docType];

        if (!doc || !doc.data) {
            return res.status(404).json({ success: false, message: "Document not found or not uploaded" });
        }

        // Decrypt the raw AES-encrypted binary back to its original file state (e.g. PDF/Image bytes)
        let exactBuffer = doc.data;
        if (typeof exactBuffer === "object" && exactBuffer.buffer) {
            // Unpack MongooseBuffer if it isn't an explicit Node buffer Array
            exactBuffer = exactBuffer.buffer;
        }

        const originalFileBytes = decryptBuffer(Buffer.from(exactBuffer));

        // Send decrypted raw binary directly to browser natively
        res.set("Content-Type", doc.contentType);
        res.set("Content-Disposition", `inline; filename="${doc.fileName}"`);
        res.send(originalFileBytes);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllEmployees,
    getEmployeeById,
    updateEmployeeProfile,
    deleteEmployee,
    getEmployeeDocument,
};
