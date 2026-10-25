
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const prisma = require("./prismaClient");

// Routes
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const importRoutes = require("./routes/import.routes");
// const studentRoutes = require("./routes/student.routes");
// const companyRoutes = require("./routes/company.routes");
// const jobRoleRoutes = require("./routes/jobRole.routes");
// const driveRoutes = require("./routes/drive.routes");
// const eligibilityRoutes = require("./routes/eligibility.routes");
// const participationRoutes = require("./routes/participation.routes");
// const selectionRoutes = require("./routes/selection.routes");
// const placementRoutes = require("./routes/placement.routes");
// const dashboardRoutes = require("./routes/dashboard.routes");
// const reportRoutes = require("./routes/report.routes");
// const documentRoutes = require("./routes/document.routes");
const emailCampaignRoutes = require("./routes/emailCampaign.routes");
// const departmentRoutes = require("./routes/department.routes");

const app = express();

// ====================
// 1. Core Middleware
// ====================

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ====================
// 2. Root Endpoint
// ====================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "TPO Placement Management API",
        version: "v1",
    });
});

// ====================
// 3. API Routes
// ====================

app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/import", importRoutes);
// app.use("/api/v1/students", studentRoutes);
// app.use("/api/v1/companies", companyRoutes);
// app.use("/api/v1/job-roles", jobRoleRoutes);
// app.use("/api/v1/drives", driveRoutes);
// app.use("/api/v1/eligibility", eligibilityRoutes);
// app.use("/api/v1/participation", participationRoutes);
// app.use("/api/v1/selections", selectionRoutes);
// app.use("/api/v1/placements", placementRoutes);
// app.use("/api/v1/dashboard", dashboardRoutes);
// app.use("/api/v1/reports", reportRoutes);
// app.use("/api/v1/documents", documentRoutes);
app.use("/api/v1/email-campaigns", emailCampaignRoutes);
// app.use("/api/v1/departments", departmentRoutes);

// ====================
// 4. Not Found Handler
// ====================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

// ====================
// 5. Central Error Handler
// ====================

app.use((err, req, res, next) => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;

    return res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : err.message || "Request failed",
    });
});

// ====================
// 6. Start Server
// ====================

const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 TPO API running at http://localhost:${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/api/v1/health`);
});

// ====================
// 7. Graceful Shutdown
// ====================

const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down server...`);

    server.close(async () => {
        try {
            await prisma.$disconnect();
            console.log("Database disconnected.");
            process.exit(0);
        } catch (error) {
            console.error("Shutdown error:", error);
            process.exit(1);
        }
    });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
