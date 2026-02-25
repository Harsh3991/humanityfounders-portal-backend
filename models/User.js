const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, USER_STATUS, DEPARTMENTS } = require("../utils/constants");

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
            select: false, // Never return password in queries by default
        },

        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.EMPLOYEE,
        },

        department: {
            type: String,
            required: function () { return ["manager", "employee"].includes(this.role); },
            default: "",
        },

        status: {
            type: String,
            enum: Object.values(USER_STATUS),
            default: USER_STATUS.PENDING,
        },

        // ─── Profile Info (filled during onboarding or by HR) ───
        phone: { type: String, default: "" },
        address: { type: String, default: "" },
        startDate: { type: Date, default: Date.now },

        // ─── Onboarding Data (PRD Section 5.1) ───
        onboarding: {
            // Step 1: Financials & Identity
            bankName: { type: String, default: "" },
            accountNumber: { type: String, default: "" }, // Will be encrypted
            ifscCode: { type: String, default: "" },
            aadhaarCard: {
                data: Buffer,
                contentType: String,
                fileName: String,
            },
            panCard: {
                data: Buffer,
                contentType: String,
                fileName: String,
            },

            // Step 2: Digital Declaration
            declarationAccepted: { type: Boolean, default: false },
            digitalSignature: { type: String, default: "" }, // Full name typed as signature
            declarationDate: { type: Date },

            // Tracking
            completedAt: { type: Date },
        },

        // ─── Auth tracking ───
        lastLogin: { type: Date },
        refreshToken: { type: String, select: false },

        // ─── Added by whom ───
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// ─── Hash password before saving ───
userSchema.pre("save", async function () {
    // Only hash if password is modified
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// ─── Compare password method ───
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// ─── Remove sensitive fields when converting to JSON ───
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.refreshToken;
    delete user.__v;
    return user;
};

userSchema.index({ status: 1 });
userSchema.index({ department: 1, status: 1 });
userSchema.index({ "fullName": "text", "email": "text" }); // Add text search index for Admin directory lookups

const User = mongoose.model("User", userSchema);

module.exports = User;
