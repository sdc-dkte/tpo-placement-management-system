const express = require("express");
const router = express.Router();

const {
    getDriveEligibleStudents,
    checkSpecificStudentEligibility,
} = require("../controllers/eligibility.controller");

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

// ==========================================
// Standalone Eligibility Engine Routes (/api/v1/eligibility)
// ==========================================

// 1. Calculate eligible students for a drive (TPO only)
router.get(
    "/drives/:driveId/students",
    authenticateToken,
    allowRoles("TPO"),
    getDriveEligibleStudents
);

// 2. Check specific student's eligibility for a drive (TPO only)
router.get(
    "/drives/:driveId/students/:studentId",
    authenticateToken,
    allowRoles("TPO"),
    checkSpecificStudentEligibility
);

module.exports = router;
