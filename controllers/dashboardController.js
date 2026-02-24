const { ROLES } = require("../utils/constants");
const {
    getEmployeeDashboard,
    getManagementDashboard,
} = require("../services/dashboardService");

/**
 * GET /api/dashboard
 * Protected — Returns role-appropriate dashboard data
 */
const getDashboard = async (req, res, next) => {
    try {
        const { _id, role } = req.user;

        let data;

        if (role === ROLES.EMPLOYEE) {
            // PRD 5.2A: Employee Dashboard
            data = await getEmployeeDashboard(_id);
        } else {
            // PRD 5.2B: Management Dashboard (Manager/HR/Admin)
            data = await getManagementDashboard(_id, role);
        }

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getDashboard,
};
