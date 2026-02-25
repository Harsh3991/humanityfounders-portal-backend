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

        // 2. Create Users
        console.log("Seeding users...");

        const adminPassword = "password123"; // Plain text, will be hashed by model hook
        const employeePassword = "password123";

        const admin = await User.create({
            fullName: "Admin User",
            email: "admin@example.com",
            password: adminPassword,
            role: ROLES.ADMIN,
            department: "Management",
            status: USER_STATUS.ACTIVE,
        });

        const hr = await User.create({
            fullName: "HR Manager",
            email: "hr@example.com",
            password: employeePassword,
            role: ROLES.HR,
            department: "Human Resources",
            status: USER_STATUS.ACTIVE,
            createdBy: admin._id,
        });

        const manager = await User.create({
            fullName: "Project Manager",
            email: "manager@example.com",
            password: employeePassword,
            role: ROLES.MANAGER,
            department: "Engineering",
            status: USER_STATUS.ACTIVE,
            createdBy: admin._id,
        });

        const employee1 = await User.create({
            fullName: "John Doe",
            email: "john@example.com",
            password: employeePassword,
            role: ROLES.EMPLOYEE,
            department: "Engineering",
            status: USER_STATUS.ACTIVE,
            createdBy: hr._id,
            phone: "1234567890",
            address: "123 Tech Lane, Silicon Valley",
        });

        const employee2 = await User.create({
            fullName: "Jane Smith",
            email: "jane@example.com",
            password: employeePassword,
            role: ROLES.EMPLOYEE,
            department: "Design",
            status: USER_STATUS.PENDING,
            createdBy: hr._id,
        });

        console.log("Users seeded successfully.");

        // 3. Create Projects
        console.log("Seeding projects...");

        const project1 = await Project.create({
            name: "NMEP Portal Development",
            description: "Building the Nawal Motor Employee Management Portal.",
            status: "active",
            members: [manager._id, employee1._id, employee2._id],
            createdBy: manager._id,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        });

        const project2 = await Project.create({
            name: "Marketing Campaign Q1",
            description: "New marketing strategy for the upcoming quarter.",
            status: "active",
            members: [manager._id, employee2._id],
            createdBy: admin._id,
            deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        });

        console.log("Projects seeded.");

        // 4. Create Tasks
        console.log("Seeding tasks...");

        await Task.create([
            {
                name: "Setup Backend Architecture",
                description: "Initialize Express, Mongoose, and basic routes.",
                project: project1._id,
                assignee: employee1._id,
                createdBy: manager._id,
                status: "done",
                priority: "high",
                completedAt: new Date(),
            },
            {
                name: "Design Login UI",
                description: "Create a modern, responsive login page.",
                project: project1._id,
                assignee: employee2._id,
                createdBy: manager._id,
                status: "in-progress",
                priority: "medium",
            },
            {
                name: "Implement Attendance Logic",
                description: "Clock-in/out functionality with active time tracking.",
                project: project1._id,
                assignee: employee1._id,
                createdBy: manager._id,
                status: "todo",
                priority: "urgent",
                dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            },
            {
                name: "Create Brand Guidelines",
                description: "Define colors, typography, and logo usage.",
                project: project2._id,
                assignee: employee2._id,
                createdBy: admin._id,
                status: "todo",
                priority: "low",
            }
        ]);

        console.log("Tasks seeded.");

        // 5. Create Attendance Records
        console.log("Seeding attendance...");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Attendance for Employee 1 (John) for yesterday
        await Attendance.create({
            user: employee1._id,
            date: yesterday,
            clockIn: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000), // 9 AM
            clockOut: new Date(yesterday.getTime() + 18 * 60 * 60 * 1000), // 6 PM
            status: "clocked-out",
            activeSeconds: 8 * 60 * 60, // 8 hours
            sessions: [
                {
                    start: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000),
                    end: new Date(yesterday.getTime() + 18 * 60 * 60 * 1000),
                    duration: 9 * 60 * 60
                }
            ],
            dailyReport: "Completed the authentication module and started testing."
        });

        // Attendance for Employee 1 (John) for today (currently clocked-in)
        await Attendance.create({
            user: employee1._id,
            date: today,
            clockIn: new Date(today.getTime() + 9 * 60 * 60 * 1000),
            status: "clocked-in",
            lastActiveAt: new Date(today.getTime() + 9 * 60 * 60 * 1000),
            sessions: [
                {
                    start: new Date(today.getTime() + 9 * 60 * 60 * 1000)
                }
            ]
        });

        console.log("Attendance seeded.");

        // 6. Create Audit Logs
        console.log("Seeding audit logs...");

        await AuditLog.create([
            {
                action: "CREATE_EMPLOYEE",
                performedBy: admin._id,
                targetUser: "Jane Smith",
                targetUserId: employee2._id,
                details: "Admin created a new employee record for Jane Smith.",
            },
            {
                action: "UPDATE_EMPLOYEE",
                performedBy: hr._id,
                targetUser: "John Doe",
                targetUserId: employee1._id,
                details: "HR updated contact information for John Doe.",
            }
        ]);

        console.log("Audit logs seeded.");

        console.log("\n🚀 SEEDING COMPLETE!");
        console.log("-------------------");
        console.log("Admin Email: admin@example.com");
        console.log("HR Email: hr@example.com");
        console.log("Manager Email: manager@example.com");
        console.log("Employee Email: john@example.com");
        console.log("Password for all: password123");
        console.log("-------------------");

        process.exit();
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();
