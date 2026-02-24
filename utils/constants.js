// ─── Role Definitions (PRD Section 3.1) ───
const ROLES = {
    ADMIN: "admin",
    HR: "hr",
    MANAGER: "manager",
    EMPLOYEE: "employee",
};

// ─── User Status ───
const USER_STATUS = {
    PENDING: "pending",   // Newly created, onboarding not complete
    ACTIVE: "active",     // Onboarding complete, full access
    INACTIVE: "inactive", // Offboarded / access revoked
};

// ─── Who can create whom (PRD Section 3.2) ───
// Admin can add: HR, Manager, Employee
// HR can add: Manager, Employee
// Manager & Employee: cannot add anyone
const CREATION_PERMISSIONS = {
    [ROLES.ADMIN]: [ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE],
    [ROLES.HR]: [ROLES.MANAGER, ROLES.EMPLOYEE],
    [ROLES.MANAGER]: [],
    [ROLES.EMPLOYEE]: [],
};

// ─── Departments ───
const DEPARTMENTS = [
    "Engineering",
    "Marketing",
    "Sales",
    "Human Resources",
    "Finance",
    "Operations",
    "Design",
    "Management",
];

module.exports = {
    ROLES,
    USER_STATUS,
    CREATION_PERMISSIONS,
    DEPARTMENTS,
};
