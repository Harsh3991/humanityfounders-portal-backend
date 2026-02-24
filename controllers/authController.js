const authService = require("../services/authService");
const { logAction } = require("./auditController");

/**
 * POST /api/auth/login
 * Public — any user can login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await authService.loginUser(email, password);

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: result.user,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/register
 * Protected — only Admin and HR can register new users
 */
const register = async (req, res, next) => {
    try {
        const newUser = await authService.registerUser(req.user, req.body);

        // Audit Log
        await logAction({
            action: "CREATE_EMPLOYEE",
            performedBy: req.user._id,
            targetUserId: newUser._id,
            targetUser: newUser.email,
            details: `Created user ${newUser.fullName} with role ${newUser.role}`
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully. Status: Pending (requires onboarding)",
            data: { user: newUser },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Protected — get current logged-in user's profile
 */
const getMe = async (req, res, next) => {
    try {
        const user = await authService.getCurrentUser(req.user._id);

        res.status(200).json({
            success: true,
            data: { user },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    register,
    getMe,
};
