const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");

// Models
const User = require("./models/User");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Attendance = require("./models/Attendance");
const AuditLog = require("./models/AuditLog");

// Constants
const { ROLES, USER_STATUS, DEPARTMENTS } = require("./utils/constants");

dotenv.config();

// Helper Data & Functions
const firstNames = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy", "Mallory", "Niaj", "Oscar", "Peggy", "Romeo", "Sybil", "Trent", "Victor", "Walter", "Zoe"];
const lastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson"];

const projectNames = ["Website Redesign", "Mobile App Launch", "Backend Overhaul", "Data Migration", "Marketing Q3", "Security Audit", "Client Portal", "HR System Upgrade", "Infrastructure Scaling", "AI Integration"];
const taskAdjectives = ["Fix", "Implement", "Design", "Review", "Test", "Deploy", "Research", "Update", "Optimize", "Document", "Refactor", "Analyze"];
const taskNouns = ["API endpoints", "user interface", "database schema", "login flow", "payment gateway", "analytics dashboard", "unit tests", "UI components", "security patches", "documentation", "system logic", "cache performance"];

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomSubset = (arr, maxItems) => {
    const subset = [];
    const count = getRandomInt(1, Math.min(arr.length, maxItems));
    const sorted = [...arr].sort(() => 0.5 - Math.random());
    return sorted.slice(0, count);
};

const getRandomDate = (startObj, maxDaysForward) => {
    const result = new Date(startObj);
    result.setDate(result.getDate() + getRandomInt(0, maxDaysForward));
    return result;
}

const seedData = async () => {
    try {
        await connectDB();

        // 1. Clear existing data
        console.log("Emptying database...");
        await User.deleteMany({});
        await Project.deleteMany({});
        await Task.deleteMany({});
        await Attendance.deleteMany({});
        await AuditLog.deleteMany({});
        console.log("Database cleared.");

        // 2. Create Core Users
        console.log("Seeding core users...");

        const password = "password123";

        const admin = await User.create({
            fullName: "Admin User",
            email: "admin@example.com",
            password: password,
            role: ROLES.ADMIN,
            department: "Management",
            status: USER_STATUS.ACTIVE,
        });

        const hr = await User.create({
            fullName: "HR Manager",
            email: "hr@example.com",
            password: password,
            role: ROLES.HR,
            department: "Human Resources",
            status: USER_STATUS.ACTIVE,
            createdBy: admin._id,
        });

        const manager1 = await User.create({
            fullName: "Project Manager 1",
            email: "manager1@example.com",
            password: password,
            role: ROLES.MANAGER,
            department: "Engineering",
            status: USER_STATUS.ACTIVE,
            createdBy: admin._id,
        });

        const manager2 = await User.create({
            fullName: "Project Manager 2",
            email: "manager2@example.com",
            password: password,
            role: ROLES.MANAGER,
            department: "Design",
            status: USER_STATUS.ACTIVE,
            createdBy: admin._id,
        });

        const managers = [manager1, manager2];

        // Create random employees
        console.log("Seeding random employees...");
        const employees = [];
        const numEmployees = 25; // 25 random employees

        for (let i = 0; i < numEmployees; i++) {
            const fname = getRandomItem(firstNames);
            const lname = getRandomItem(lastNames);

            // Randomly pick unique emails
            const email = `${fname.toLowerCase()}.${lname.toLowerCase()}${getRandomInt(1, 9999)}@example.com`;
            const department = getRandomItem(DEPARTMENTS);

            const emp = await User.create({
                fullName: `${fname} ${lname}`,
                email: email,
                password: password,
                role: ROLES.EMPLOYEE,
                department: department,
                status: Math.random() < 0.9 ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
                createdBy: hr._id,
                phone: `555${getRandomInt(1000000, 9999999)}`,
                address: `${getRandomInt(10, 999)} Seed Ave`,
            });
            employees.push(emp);
        }

        // Add explicit employee account we expect for login tests based on prev prompt
        const testEmployee = await User.create({
            fullName: "John Doe",
            email: "john@example.com",
            password: password,
            role: ROLES.EMPLOYEE,
            department: "Engineering",
            status: USER_STATUS.ACTIVE,
            createdBy: hr._id,
            phone: "1234567890",
            address: "123 Tech Lane, Silicon Valley",
        });
        employees.push(testEmployee);

        const allUsers = [...managers, ...employees];
        console.log(`Created ${employees.length} employees.`);

        // 3. Create Projects
        console.log("Seeding projects...");
        const projects = [];

        for (let i = 0; i < projectNames.length; i++) {
            const numMembers = getRandomInt(4, 12);
            const projMembers = getRandomSubset(employees, numMembers);
            // Include a manager
            const manager = getRandomItem(managers);
            projMembers.push(manager);

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - getRandomInt(0, 30));

            const proj = await Project.create({
                name: projectNames[i],
                description: `A project to address ${projectNames[i].toLowerCase()}`,
                status: getRandomItem(["active", "active", "active", "completed", "on-hold"]),
                members: projMembers.map(m => m._id),
                createdBy: manager._id,
                deadline: getRandomDate(new Date(), 90),
                createdAt: startDate
            });
            projects.push(proj);
        }
        console.log(`Created ${projects.length} projects.`);

        // 4. Create Tasks
        console.log("Seeding tasks...");
        const tasks = [];

        for (const proj of projects) {
            // Generating multiple tasks with random assignees and priorities
            const numTasks = getRandomInt(8, 20);
            for (let i = 0; i < numTasks; i++) {
                const adj = getRandomItem(taskAdjectives);
                const noun = getRandomItem(taskNouns);
                const taskName = `${adj} ${noun} for ${proj.name}`;

                // assign to random member of project
                const assignee = getRandomItem(proj.members);
                const isCompleted = Math.random() < 0.35;
                const statusOptions = isCompleted ? ["done"] : ["todo", "in-progress", "review"];
                const priorityOptions = ["low", "none", "medium", "high", "urgent"];

                const taskStatus = getRandomItem(statusOptions);
                const taskPriority = getRandomItem(priorityOptions);
                const taskDueDate = getRandomDate(new Date(), Math.random() < 0.2 ? -5 : 30); // Some overdue

                const task = await Task.create({
                    name: taskName,
                    description: `Detailed task description for ${taskName}`,
                    project: proj._id,
                    assignee: assignee,
                    createdBy: proj.createdBy,
                    status: taskStatus,
                    priority: taskPriority,
                    dueDate: taskDueDate,
                    completedAt: taskStatus === "done" ? new Date() : null
                });
                tasks.push(task);
            }
        }
        console.log(`Created ${tasks.length} tasks.`);

        // 5. Create Attendance Records
        console.log("Seeding attendance...");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const user of allUsers) {
            // Generate past 20 days of attendance for each user
            for (let d = 20; d >= 0; d--) {
                const currDate = new Date(today);
                currDate.setDate(currDate.getDate() - d);

                // skip some weekends
                const dayOfWeek = currDate.getDay();
                if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.95) continue;

                // Create variety of absent, clocked-in, clocked-out statuses
                const isAbsent = Math.random() < 0.1; // 10% absent rate

                if (isAbsent) {
                    await Attendance.create({
                        user: user._id,
                        date: currDate,
                        status: "absent"
                    });
                } else {
                    // Start time between 8 and 10 AM
                    const startHour = getRandomInt(8, 10);
                    const startMin = getRandomInt(0, 59);
                    const clockInTime = new Date(currDate);
                    clockInTime.setHours(startHour, startMin, 0, 0);

                    if (d === 0) {
                        // Today
                        const isClockedIn = Math.random() < 0.75;
                        if (isClockedIn) {
                            await Attendance.create({
                                user: user._id,
                                date: currDate,
                                clockIn: clockInTime,
                                status: "clocked-in",
                                lastActiveAt: clockInTime,
                                sessions: [{ start: clockInTime }]
                            });
                        } else {
                            // clocked out early today
                            const durationSeconds = getRandomInt(1000, 14000);
                            const clockOutTime = new Date(clockInTime.getTime() + durationSeconds * 1000);
                            await Attendance.create({
                                user: user._id,
                                date: currDate,
                                clockIn: clockInTime,
                                clockOut: clockOutTime,
                                status: "clocked-out",
                                activeSeconds: durationSeconds,
                                sessions: [{ start: clockInTime, end: clockOutTime, duration: durationSeconds }],
                                dailyReport: "Worked on high priority issues before leaving early."
                            });
                        }
                    } else {
                        // Past days are all clocked out
                        const workedHours = getRandomInt(6, 9);
                        const durationSeconds = workedHours * 60 * 60 + getRandomInt(0, 3600);
                        const clockOutTime = new Date(clockInTime.getTime() + durationSeconds * 1000);

                        // Small chance of extremely long overtime
                        const finalSeconds = Math.random() > 0.95 ? durationSeconds + getRandomInt(3600, 7200) : durationSeconds;
                        const finalOutTime = new Date(clockInTime.getTime() + finalSeconds * 1000);

                        await Attendance.create({
                            user: user._id,
                            date: currDate,
                            clockIn: clockInTime,
                            clockOut: finalOutTime,
                            status: "clocked-out",
                            activeSeconds: finalSeconds,
                            sessions: [{ start: clockInTime, end: finalOutTime, duration: finalSeconds }],
                            dailyReport: getRandomItem([
                                "Completed assigned tickets.",
                                "Attended sprint planning.",
                                "Fixed bugs in the UI.",
                                "Database migrations and schema updates.",
                                "Researched implementation details and coded components.",
                                "Reviewed PRs and tested changes.",
                                "Routine daily work."
                            ])
                        });
                    }
                }
            }
        }
        console.log("Attendance seeded.");

        // 6. Create Audit Logs
        console.log("Seeding audit logs...");
        await AuditLog.create([
            {
                action: "CREATE_EMPLOYEE",
                performedBy: admin._id,
                targetUser: employees[0].fullName,
                targetUserId: employees[0]._id,
                details: "Admin created a new employee record.",
            },
            {
                action: "UPDATE_EMPLOYEE",
                performedBy: hr._id,
                targetUser: employees[1].fullName,
                targetUserId: employees[1]._id,
                details: "HR updated contact information.",
            }
        ]);
        console.log("Audit logs seeded.");

        console.log("\n🚀 SEEDING COMPLETE!");
        console.log("-------------------");
        console.log("Admin Email: admin@example.com");
        console.log("HR Email: hr@example.com");
        console.log("Manager Email: manager1@example.com");
        console.log("Test Employee Email: john@example.com");
        console.log("Other randomly generated employees (e.g. " + employees[0].email + ")");
        console.log("Password for all: password123");
        console.log("-------------------");

        process.exit();
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();