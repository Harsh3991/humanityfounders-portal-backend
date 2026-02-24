const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// Load environment variables
dotenv.config();

// Import config
const connectDB = require("./config/db");
const corsOptions = require("./config/cors");
const errorHandler = require("./middleware/errorHandler");

// Initialize Express
const app = express();

// ─── Core Middleware ───
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // CORS
app.use(morgan("dev")); // Request logging
app.use(express.json({ limit: "10mb" })); // Parse JSON (increased limit for document uploads)
app.use(express.urlencoded({ extended: true }));

// ─── Health Check & Root Routes ───
app.get("/", (req, res) => {
    res.redirect("/api/health");
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Humanity Founders API is running 🚀",
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

// ─── API Routes (will be added as we build features) ───
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/onboarding", require("./routes/onboardingRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/audit", require("./routes/auditRoutes"));

// ─── 404 Handler ───
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.originalUrl}`,
    });
});

// ─── Global Error Handler ───
app.use(errorHandler);

// ─── Start Server ───
const PORT = process.env.PORT || 5000;

// Connect to MongoDB immediately at boot up
connectDB();

// Only listen if not running in a serverless (like Vercel) environment
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health\n`);
    });
}

// Export the Express API for Vercel
module.exports = app;
