const User = require("../models/User");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { CREATION_PERMISSIONS, USER_STATUS, ROLES } = require("../utils/constants");
const { decrypt } = require("../utils/encryptData");
const { sendWelcomeEmail } = require("../utils/emailService");

/**
 * Helper to decrypt sensitive fields for authorized viewing
 */
const getDecryptedUser = (user) => {
    const userData = user.toJSON();
    if (userData.onboarding && userData.onboarding.accountNumber) {
        try {
            userData.onboarding.accountNumber = decrypt(userData.onboarding.accountNumber);
        } catch (err) {
            console.error("Decryption failed for user:", user._id);
        }
    }
    return userData;
};

/**
 * Login user — validate credentials, generate tokens
 */
const loginUser = async (email, password) => {
    // Find user and include password field (it's select: false by default)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    if (user.status === USER_STATUS.INACTIVE) {
        const error = new Error("Account has been deactivated. Contact HR.");
        error.statusCode = 401;
        throw error;
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user document
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
        accessToken,
        refreshToken,
        user: getDecryptedUser(user),
    };
};

/**
 * Register a new user — only Admin and HR can do this
 */
const registerUser = async (creatorUser, userData) => {
    const { fullName, email, password, role, department } = userData;

    // Check if creator has permission to create this role
    const allowedRoles = CREATION_PERMISSIONS[creatorUser.role];
    if (!allowedRoles || !allowedRoles.includes(role)) {
        const error = new Error(
            `${creatorUser.role} cannot create users with role: ${role}`
        );
        error.statusCode = 403;
        throw error;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        const error = new Error("User with this email already exists");
        error.statusCode = 400;
        throw error;
    }

    // Create user with status "pending" (needs onboarding)
    const newUser = await User.create({
        fullName,
        email,
        password,
        role,
        department,
        status: USER_STATUS.PENDING,
        createdBy: creatorUser._id,
    });

    // Send email notification non-blocking (doesn't fail creation if email fails)
    try {
        await sendWelcomeEmail(email, fullName, password);
    } catch (err) {
        console.error("Failed to send welcome email to", email, err);
    }

    return newUser.toJSON();
};

/**
 * Get current user profile
 */
const getCurrentUser = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    return getDecryptedUser(user);
};

module.exports = {
    loginUser,
    registerUser,
    getCurrentUser,
};
