const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

// Models
const User = require("./models/User");
const Project = require("./models/Project");
const Task = require("./models/Task");
const Attendance = require("./models/Attendance");
const AuditLog = require("./models/AuditLog");

// Constants
const { ROLES, USER_STATUS } = require("./utils/constants");

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

        console.log("Users created.");

        // 3. Project 1: Bio Waste Agency
        console.log("Seeding Project: Bio Waste Agency...");

        const bioWasteProject = await Project.create({
            name: "Bio Waste Agency",
            description: "Bio waste management system and field agent portal.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-03-10")
        });

        const dashboardSprint = await Task.create({
            name: "Dashboard",
            project: bioWasteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        const techImplTask = await Task.create({
            name: "Technical Implementation",
            project: bioWasteProject._id,
            parentTask: dashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Google sheet synch with dashboard",
            project: bioWasteProject._id,
            parentTask: techImplTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Pending Payment alert function",
            project: bioWasteProject._id,
            parentTask: techImplTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Dashboard for the Field Agents",
            project: bioWasteProject._id,
            parentTask: dashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Payment tracking page for the Admin",
            project: bioWasteProject._id,
            parentTask: dashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Minor bug fixing",
            project: bioWasteProject._id,
            parentTask: dashboardSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: new Date("2026-02-18")
        });

        await Task.create({
            name: "Minor issues before client meet",
            project: bioWasteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-19")
        });

        const clientFeedbackSprint = await Task.create({
            name: "Client Feedback",
            project: bioWasteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-20")
        });

        await Task.create({
            name: "Waiting for client Feedback",
            project: bioWasteProject._id,
            parentTask: clientFeedbackSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const addFeedbackTask = await Task.create({
            name: "Add clinet feedback here",
            project: bioWasteProject._id,
            parentTask: clientFeedbackSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "audio option in feild agent remark option.",
            project: bioWasteProject._id,
            parentTask: addFeedbackTask._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Restore option for rejected pending amount.",
            project: bioWasteProject._id,
            parentTask: addFeedbackTask._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "More client feedback",
            project: bioWasteProject._id,
            parentTask: clientFeedbackSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: new Date("2026-02-23")
        });

        // 4. Project 2: APP Launch
        console.log("Seeding Project: APP Launch...");

        const appLaunchProject = await Project.create({
            name: "APP Launch",
            description: "Launch phases of AI-driven applications: Headshot, FaceGPT, SkinGPT.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-04-30")
        });

        const headshotSprint = await Task.create({
            name: "Sprint [Headshot] : Launch Version 1",
            project: appLaunchProject._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Plan",
            project: appLaunchProject._id,
            parentTask: headshotSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "UI/UX",
            project: appLaunchProject._id,
            parentTask: headshotSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-23")
        });

        const faceGPTSprint = await Task.create({
            name: "Sprint [FaceGPT]: Launch Version 1.1",
            project: appLaunchProject._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "urgent",
            dueDate: new Date("2026-02-20")
        });

        const faceTechTask = await Task.create({
            name: "Technical Implementation",
            project: appLaunchProject._id,
            parentTask: faceGPTSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task 1.1 Create setupUser API",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 1.2 Create Check_Credit API",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 1.3 Create Deduct Credit API",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 1.4 Integrate userDetails API",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 1.5 Integrate upload-url API",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        const minorUITask = await Task.create({
            name: "Task 1.6 Minor UI Changes",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-15")
        });

        await Task.create({
            name: "Task 1.7 Payment Implementation",
            project: appLaunchProject._id,
            parentTask: minorUITask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "Task 1.8 Push Changes on the App Store/Play Store",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-18")
        });

        await Task.create({
            name: "Task 1.9 Running test cases",
            project: appLaunchProject._id,
            parentTask: faceTechTask._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: new Date("2026-02-20")
        });

        const marketingTask = await Task.create({
            name: "Marketing Implementation",
            project: appLaunchProject._id,
            parentTask: faceGPTSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "App Store Optimization",
            project: appLaunchProject._id,
            parentTask: marketingTask._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: new Date("2026-02-20")
        });

        await Task.create({
            name: "Partner with an Influencer over X",
            project: appLaunchProject._id,
            parentTask: marketingTask._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: new Date("2026-02-20")
        });

        const marketingPlanTask = await Task.create({
            name: "Come up with Marketing Plan for FaceGPT",
            project: appLaunchProject._id,
            parentTask: marketingTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Plan discription",
            project: appLaunchProject._id,
            parentTask: marketingPlanTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const taskIdeaSprint = await Task.create({
            name: "Sprint [Task Idea] - Launch Version 1",
            project: appLaunchProject._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "high",
            dueDate: new Date("2026-02-27")
        });

        await Task.create({
            name: "UI/ UX Figma file",
            project: appLaunchProject._id,
            parentTask: taskIdeaSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-12")
        });

        const taskIdeaTechTask = await Task.create({
            name: "Technical Implementation",
            project: appLaunchProject._id,
            parentTask: taskIdeaSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Backend implementation",
            project: appLaunchProject._id,
            parentTask: taskIdeaTechTask._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-12")
        });

        await Task.create({
            name: "Flutter Devlopment",
            project: appLaunchProject._id,
            parentTask: taskIdeaSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Push to App store / Play Store",
            project: appLaunchProject._id,
            parentTask: taskIdeaSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Improvement for UI/UX desgine",
            project: appLaunchProject._id,
            parentTask: taskIdeaSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: new Date("2026-02-23")
        });

        const skinGPTSprint = await Task.create({
            name: "Sprint [SkinGPT]: Launch Version 1",
            project: appLaunchProject._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "UI/UX Deliverable",
            project: appLaunchProject._id,
            parentTask: skinGPTSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: new Date("2026-02-21")
        });

        await Task.create({
            name: "Fullter Devlopment",
            project: appLaunchProject._id,
            parentTask: skinGPTSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Push To APP store/ Play Store",
            project: appLaunchProject._id,
            parentTask: skinGPTSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        const ideasSprint = await Task.create({
            name: "Sprint [Ideas] - Listing all the Ideas",
            project: appLaunchProject._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "high",
            dueDate: null
        });

        await Task.create({
            name: "FaceGPT",
            project: appLaunchProject._id,
            parentTask: ideasSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "SkinGPT",
            project: appLaunchProject._id,
            parentTask: ideasSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task Tree Idea",
            project: appLaunchProject._id,
            parentTask: ideasSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Headshot.Ai",
            project: appLaunchProject._id,
            parentTask: ideasSprint._id,
            createdBy: admin._id,
            status: "in-progress",
            priority: "none",
            dueDate: null
        });

        // 5. Project 3: HF Website
        console.log("Seeding Project: HF Website...");

        const hfWebsiteProject = await Project.create({
            name: "HF Website",
            description: "Finalization and implementation of the website's key pages, including global visualization and team portal.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-03-31")
        });

        const sprint1HF = await Task.create({
            name: "Sprint 1: Finalizing Project and Teams Page",
            project: hfWebsiteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 2.1: Finalizing Content for Teams and Project Page",
            project: hfWebsiteProject._id,
            parentTask: sprint1HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task 2.2: Implementing Finalized code to Website",
            project: hfWebsiteProject._id,
            parentTask: sprint1HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const sprint2HF = await Task.create({
            name: "Sprint 2: Finalizing globe and Portal",
            project: hfWebsiteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Task 1.1: Creating a Figma File for Home Page and Footer",
            project: hfWebsiteProject._id,
            parentTask: sprint2HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task 1.2: Creating the Globe File and Footer",
            project: hfWebsiteProject._id,
            parentTask: sprint2HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task 1.3: Finalizing The Home Page and footer",
            project: hfWebsiteProject._id,
            parentTask: sprint2HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const sprint3HF = await Task.create({
            name: "Sprint 3: Feedback and Implementation",
            project: hfWebsiteProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "PreLoader",
            project: hfWebsiteProject._id,
            parentTask: sprint3HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "About section Images",
            project: hfWebsiteProject._id,
            parentTask: sprint3HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "Logos",
            project: hfWebsiteProject._id,
            parentTask: sprint3HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "Pushing code to Git Lab",
            project: hfWebsiteProject._id,
            parentTask: sprint3HF._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        // 6. Project 4: Nawal Moter Portal
        console.log("Seeding Project: Nawal Moter Portal...");

        const nawalProject = await Project.create({
            name: "Nawal Moter Portal",
            description: "Full-stack development of an administrative and employee portal.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-05-31")
        });

        const nDashboardSprint = await Task.create({
            name: "Sprint 1: Dashboard (Command Center)",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        const nDashResearch = await Task.create({
            name: "Research",
            project: nawalProject._id,
            parentTask: nDashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Research dashboard layout inspiration and required administrative stats",
            project: nawalProject._id,
            parentTask: nDashResearch._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const nDashFrontend = await Task.create({
            name: "Frontend (Components & Features)",
            project: nawalProject._id,
            parentTask: nDashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Build Dashboard.jsx main layout",
            project: nawalProject._id,
            parentTask: nDashFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Create StatCard components (Total Staff, Present, Absent, Pending)",
            project: nawalProject._id,
            parentTask: nDashFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Implement QuickAction grid (Add Employee, Mark Attendance)",
            project: nawalProject._id,
            parentTask: nDashFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Build PayrollModal (Wizard with steps: Input, Loading, Result)",
            project: nawalProject._id,
            parentTask: nDashFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Build 'Mark Attendance' popup modal",
            project: nawalProject._id,
            parentTask: nDashFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const nDashBackend = await Task.create({
            name: "Backend (Endpoints)",
            project: nawalProject._id,
            parentTask: nDashboardSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate GET /api/admin/dashboard (Fetch real-time stats)",
            project: nawalProject._id,
            parentTask: nDashBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate GET /employees (Fetch list for dropdowns)",
            project: nawalProject._id,
            parentTask: nDashBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate POST /attendance (Submit daily attendance)",
            project: nawalProject._id,
            parentTask: nDashBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate POST /salary/generate (Trigger monthly payroll)",
            project: nawalProject._id,
            parentTask: nDashBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const nEmpDetailSprint = await Task.create({
            name: "Sprint 2: Employee Detail Page (Admin View)",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        const nEmpResearch = await Task.create({
            name: "Research",
            project: nawalProject._id,
            parentTask: nEmpDetailSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Research comprehensive HR profile structures and salary increments",
            project: nawalProject._id,
            parentTask: nEmpResearch._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const nEmpFrontend = await Task.create({
            name: "Frontend (Components & Features)",
            project: nawalProject._id,
            parentTask: nEmpDetailSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Build EmployeeDetail.jsx layout with top-level Profile Card",
            project: nawalProject._id,
            parentTask: nEmpFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Implement complex Tabbed Interface (Personal, Family, Job, Financials)",
            project: nawalProject._id,
            parentTask: nEmpFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Create reusable InfoRow component for standardized data display",
            project: nawalProject._id,
            parentTask: nEmpFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Build Financials tab with Base Salary Overview and Structure History",
            project: nawalProject._id,
            parentTask: nEmpFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Create 'Update Salary Structure' Modal (Increment/Decrement form)",
            project: nawalProject._id,
            parentTask: nEmpFrontend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        const nEmpBackend = await Task.create({
            name: "Backend (Endpoints)",
            project: nawalProject._id,
            parentTask: nEmpDetailSprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate GET /employees/:id (Fetch specific employee details)",
            project: nawalProject._id,
            parentTask: nEmpBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate GET /salary/history (Fetch targeted payment history)",
            project: nawalProject._id,
            parentTask: nEmpBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Task: Integrate POST /employees/:id/increment (Submit structure changes)",
            project: nawalProject._id,
            parentTask: nEmpBackend._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Sprint 3: My Space Page (Employee Self-Service)",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Sprint 4: Attendance Logs Page",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        await Task.create({
            name: "Sprint 5: Salary Reports Page (Payroll Ledger)",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-13")
        });

        const nDeploySprint = await Task.create({
            name: "Sprint 6: Deployment and Testing",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-18")
        });

        await Task.create({
            name: "Deployment",
            project: nawalProject._id,
            parentTask: nDeploySprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-16")
        });

        await Task.create({
            name: "Fixing minor Bug issues",
            project: nawalProject._id,
            parentTask: nDeploySprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Working on Program Manager feedback",
            project: nawalProject._id,
            parentTask: nDeploySprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-21")
        });

        await Task.create({
            name: "Video Overview for client meeting",
            project: nawalProject._id,
            parentTask: nDeploySprint._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-19")
        });

        await Task.create({
            name: "Sprint 6.5 FrontEnd Improvement",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: new Date("2026-02-24")
        });

        const nClientMeetSprint = await Task.create({
            name: "Sprint 7: Meeting with client for Feedback",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({
            name: "Add all the feedback here received during meeting.",
            project: nawalProject._id,
            parentTask: nClientMeetSprint._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: null
        });

        await Task.create({
            name: "Sprint 8: Work Upon Client Feedback",
            project: nawalProject._id,
            createdBy: admin._id,
            status: "todo",
            priority: "none",
            dueDate: new Date("2026-02-20")
        });

        // 7. Project 5: HF Portal
        console.log("Seeding Project: HF Portal...");

        const hfPortalProject = await Project.create({
            name: "HF Portal",
            description: "Internal portal development focusing on role-based access, attendance tracking with live timers, and data security.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-03-31")
        });

        const hfSprint0 = await Task.create({
            name: "Sprint 0: Finalizing the PRD of Portal and Initial Setup",
            project: hfPortalProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-17")
        });

        await Task.create({ name: "Task 1.1: Setup Frontend and Backend Codes in local System", project: hfPortalProject._id, parentTask: hfSprint0._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-16") });
        await Task.create({ name: "Task 1.2: Feedback and locking of PRD", project: hfPortalProject._id, parentTask: hfSprint0._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-17") });

        const hfSprint1 = await Task.create({ name: "Sprint 1: Login Page", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        await Task.create({ name: "Research", project: hfPortalProject._id, parentTask: hfSprint1._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        const hfLoginTech = await Task.create({ name: "technical implementation", project: hfPortalProject._id, parentTask: hfSprint1._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        await Task.create({ name: "Task : Frontend", project: hfPortalProject._id, parentTask: hfLoginTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Backend", project: hfPortalProject._id, parentTask: hfLoginTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const hfSprint2 = await Task.create({ name: "Sprint 2: Onboarding Wizard", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        await Task.create({ name: "Research", project: hfPortalProject._id, parentTask: hfSprint2._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfOnboardTech = await Task.create({ name: "technical implementation", project: hfPortalProject._id, parentTask: hfSprint2._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task : Frontend", project: hfPortalProject._id, parentTask: hfOnboardTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Backend", project: hfPortalProject._id, parentTask: hfOnboardTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const hfSprint3 = await Task.create({ name: "Sprint 3: Dashboard", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        await Task.create({ name: "Research", project: hfPortalProject._id, parentTask: hfSprint3._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfDashTech = await Task.create({ name: "technical implementation", project: hfPortalProject._id, parentTask: hfSprint3._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfDashFrontend = await Task.create({ name: "Task : Frontend", project: hfPortalProject._id, parentTask: hfDashTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Dashboard API call - api/dashboardApi.js", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Left navigation with brand, nav links, role-based menu", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Sidebar + main content layout wrapper", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Full role-based dashboard with widgets", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Sidebar styling", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Dashboard widgets, stats cards, task/project list styling", project: hfPortalProject._id, parentTask: hfDashFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfDashBackend = await Task.create({ name: "Task : Backend", project: hfPortalProject._id, parentTask: hfDashTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Attendance schema (clock in/out, breaks, daily report)", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Project schema (name, members, status, deadline)", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task schema (assignee, priority, status workflow)", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "All dashboard queries with Promise.all for parallel execution", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Single endpoint delegates to correct service based on role", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "GET /api/dashboard (protected)", project: hfPortalProject._id, parentTask: hfDashBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const hfSprint4 = await Task.create({ name: "Sprint 4: Clock in/Clock out", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-18") });
        const hfClockTech = await Task.create({ name: "technical implementation", project: hfPortalProject._id, parentTask: hfSprint4._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfClockFrontend = await Task.create({ name: "Task : Frontend", project: hfPortalProject._id, parentTask: hfClockTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "AttendanceWidget.jsx (Live Timer, Smart Buttons, Multi-Session)", project: hfPortalProject._id, parentTask: hfClockFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "ClockOutModal.jsx", project: hfPortalProject._id, parentTask: hfClockFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Styling (Modern badges, Blinking animation)", project: hfPortalProject._id, parentTask: hfClockFrontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        const hfClockBackend = await Task.create({ name: "Task : Backend", project: hfPortalProject._id, parentTask: hfClockTech._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Data Model - Attendance.js", project: hfPortalProject._id, parentTask: hfClockBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Controller Logic - attendanceController.js", project: hfPortalProject._id, parentTask: hfClockBackend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        await Task.create({ name: "Sprint 5: Attendance Tab", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-19") });
        await Task.create({ name: "Sprint 6: People Tab", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-19") });
        await Task.create({ name: "Sprint 7: Project Management", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-19") });
        await Task.create({ name: "Sprint 8: Admin Task Oversight", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-28") });
        const hfSprint9 = await Task.create({ name: "Sprint 9: Encryption and Security of data", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research (Codebase Scan, Environment Check, Library Choice)", project: hfPortalProject._id, parentTask: hfSprint9._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: technical implementation (Backend)", project: hfPortalProject._id, parentTask: hfSprint9._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Sprint 10: Audit Logs", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Sprint 11: Improving Front End", project: hfPortalProject._id, createdBy: admin._id, status: "in-progress", priority: "none", dueDate: new Date("2026-02-20") });
        await Task.create({ name: "Sprint Version 1.0", project: hfPortalProject._id, createdBy: admin._id, status: "done", priority: "none", dueDate: new Date("2026-02-21") });

        // 8. Project 6: SurplusShare
        console.log("Seeding Project: SurplusShare...");

        const surplusProject = await Project.create({
            name: "SurplusShare",
            description: "Platform for food donations between suppliers and NGOs, with OAuth, metrics, and leaderboards.",
            status: "active",
            members: [admin._id, testEmployee._id],
            createdBy: admin._id,
            deadline: new Date("2026-06-30")
        });

        // Sprint 1: Authentication & Onboarding (Shared View)
        const sSprint1 = await Task.create({
            name: "Sprint 1: Authentication & Onboarding (Shared View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-25") // 6 days ago from Mar 3
        });

        const sS1Research = await Task.create({ name: "Research", project: surplusProject._id, parentTask: sSprint1._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research Google OAuth integration flows and role-based redirect logic.", project: surplusProject._id, parentTask: sS1Research._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS1Frontend = await Task.create({ name: "Frontend (Components & Features)", project: surplusProject._id, parentTask: sSprint1._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build Landing page layout.", project: surplusProject._id, parentTask: sS1Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Create Login and Signup forms (NGO & Supplier variants).", project: surplusProject._id, parentTask: sS1Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Implement Google OAuth provider and local storage context.", project: surplusProject._id, parentTask: sS1Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Set up AuthRoute and ProtectedRoute guards in App.jsx.", project: surplusProject._id, parentTask: sS1Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS1Backend = await Task.create({ name: "Backend (Endpoints)", project: surplusProject._id, parentTask: sSprint1._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate POST /api/auth/register (Handle NGO/Supplier role creation).", project: surplusProject._id, parentTask: sS1Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate POST /api/auth/google.", project: surplusProject._id, parentTask: sS1Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate POST /api/auth/login.", project: surplusProject._id, parentTask: sS1Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        // Sprint 2: Dashboard & Metrics (Supplier View)
        const sSprint2 = await Task.create({
            name: "Sprint 2: Dashboard & Metrics (Supplier View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-27") // 4 days ago from Mar 3
        });

        const sS2Research = await Task.create({ name: "Research", project: surplusProject._id, parentTask: sSprint2._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research dashboard layout inspiration and donation metric visualizations.", project: surplusProject._id, parentTask: sS2Research._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS2Frontend = await Task.create({ name: "Frontend (Components & Features)", project: surplusProject._id, parentTask: sSprint2._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build DashboardSupplier main layout.", project: surplusProject._id, parentTask: sS2Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Create StatCard components for donation metrics.", project: surplusProject._id, parentTask: sS2Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Implement global Leaderboard UI component.", project: surplusProject._id, parentTask: sS2Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS2Backend = await Task.create({ name: "Backend (Endpoints)", project: surplusProject._id, parentTask: sSprint2._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate GET /api/posts/metrics (Fetch supplier real-time stats).", project: surplusProject._id, parentTask: sS2Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate GET /api/posts/leaderboard (Fetch top donors).", project: surplusProject._id, parentTask: sS2Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        // Sprint 3: Food Posting & Scheduling (Supplier View)
        const sSprint3 = await Task.create({
            name: "Sprint 3: Food Posting & Scheduling (Supplier View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-27")
        });

        const sS3Research = await Task.create({ name: "Research", project: surplusProject._id, parentTask: sSprint3._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research form validation UX and image upload drag-and-drop interfaces.", project: surplusProject._id, parentTask: sS3Research._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS3Frontend = await Task.create({ name: "Frontend (Components & Features)", project: surplusProject._id, parentTask: sSprint3._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build PostFood form with FormData handling for image uploads.", project: surplusProject._id, parentTask: sS3Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build ScheduleDonation calendar and time-picker interface.", project: surplusProject._id, parentTask: sS3Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS3Backend = await Task.create({ name: "Backend (Endpoints)", project: surplusProject._id, parentTask: sSprint3._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Set up multer storage and static /uploads directory in server.js.", project: surplusProject._id, parentTask: sS3Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate POST /api/posts (Create food post with image).", project: surplusProject._id, parentTask: sS3Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        // Sprint 4: Dashboard & Listings (NGO View)
        const sSprint4 = await Task.create({
            name: "Sprint 4: Dashboard & Listings (NGO View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-27")
        });

        const sS4Research = await Task.create({ name: "Research", project: surplusProject._id, parentTask: sSprint4._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research card-based grid layouts for browsing available food listings.", project: surplusProject._id, parentTask: sS4Research._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS4Frontend = await Task.create({ name: "Frontend (Components & Features)", project: surplusProject._id, parentTask: sSprint4._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build DashboardNGO main layout and stat cards.", project: surplusProject._id, parentTask: sS4Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Create ListingsNGO page with a grid view for active food posts.", project: surplusProject._id, parentTask: sS4Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS4Backend = await Task.create({ name: "Backend (Endpoints)", project: surplusProject._id, parentTask: sSprint4._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate GET /api/posts/ngo/metrics (Fetch NGO dashboard stats).", project: surplusProject._id, parentTask: sS4Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        // Sprint 5: Food Detail & Claiming (NGO View)
        const sSprint5 = await Task.create({
            name: "Sprint 5: Food Detail & Claiming (NGO View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-27")
        });

        const sS5Research = await Task.create({ name: "Research", project: surplusProject._id, parentTask: sSprint5._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Task: Research confirmation modals and claim-action workflows.", project: surplusProject._id, parentTask: sS5Research._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS5Frontend = await Task.create({ name: "Frontend (Components & Features)", project: surplusProject._id, parentTask: sSprint5._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Build FoodDetailNGO page layout showing item specifics and images.", project: surplusProject._id, parentTask: sS5Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Implement 'Claim Food' button and confirmation popup modal.", project: surplusProject._id, parentTask: sS5Frontend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        const sS5Backend = await Task.create({ name: "Backend (Endpoints)", project: surplusProject._id, parentTask: sSprint5._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate GET /api/posts/:id (Fetch specific post details).", project: surplusProject._id, parentTask: sS5Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });
        await Task.create({ name: "Integrate POST /api/posts/:id/claim (Submit claim request).", project: surplusProject._id, parentTask: sS5Backend._id, createdBy: admin._id, status: "done", priority: "none", dueDate: null });

        // Sprint 6: Post Management & History (Supplier View)
        await Task.create({
            name: "Sprint 6: Post Management & History (Supplier View)",
            project: surplusProject._id,
            createdBy: admin._id,
            status: "done",
            priority: "none",
            dueDate: new Date("2026-02-27")
        });

        console.log("SurplusShare project seeded.");

        console.log("\n🚀 SEEDING COMPLETE!");
        console.log("-------------------");
        console.log("Admin Email: admin@example.com");
        console.log("HR Email: hr@example.com");
        console.log("Test Employee Email: john@example.com");
        console.log("Password for all: password123");
        console.log("-------------------");

        process.exit();
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
};

seedData();
