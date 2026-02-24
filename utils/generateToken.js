const jwt = require("jsonwebtoken");

/**
 * Generate Access Token (short-lived)
 * Contains: userId, role, status
 */
const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            status: user.status,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );
};

/**
 * Generate Refresh Token (long-lived)
 * Contains: only userId (minimal data)
 */
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || "30d" }
    );
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
};
