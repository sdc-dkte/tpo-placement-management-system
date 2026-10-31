const express = require("express");
const router = express.Router();

const {
    createDrive,
    getDrives,
    getDriveById,
    updateDrive,
    updateDriveStatus,
    getEligibilityCriteria,
    replaceEligibilityCriteria,
    getEligibleStudents,
    getMyEligibility,
} = require("../controllers/drive.controller");

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

// ==========================================
// Placement Drive Routes (/api/v1/drives)
// ==========================================

// 1. List / Search placement drives (TPO and Students)
router.get("/", authenticateToken, allowRoles("TPO", "STUDENT"), getDrives);

// 2. Create new placement drive with company, job role, and criteria (TPO only)
router.post("/", authenticateToken, allowRoles("TPO"), createDrive);

// 3. Current student's drive eligibility check (Student only)
router.get(
    ["/:driveId/eligibility/me", "/:driveId/eligibility"],
    authenticateToken,
    allowRoles("STUDENT"),
    getMyEligibility
);

// 4. Drive details (TPO and Students)
router.get(
    "/:driveId",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getDriveById
);

// 5. Update drive details (TPO only)
router.patch("/:driveId", authenticateToken, allowRoles("TPO"), updateDrive);

// 6. Update drive lifecycle status (UPCOMING, ONGOING, COMPLETED, CANCELLED) (TPO only)
router.patch(
    "/:driveId/status",
    authenticateToken,
    allowRoles("TPO"),
    updateDriveStatus
);

// 7. Get drive eligibility criteria (TPO and Students)
router.get(
    "/:driveId/eligibility-criteria",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getEligibilityCriteria
);

// 8. Replace drive eligibility criteria atomically (TPO only)
router.put(
    "/:driveId/eligibility-criteria",
    authenticateToken,
    allowRoles("TPO"),
    replaceEligibilityCriteria
);

// 9. Calculate eligible students via Dynamic Eligibility Engine (TPO only)
router.get(
    "/:driveId/eligible-students",
    authenticateToken,
    allowRoles("TPO"),
    getEligibleStudents
);

module.exports = router;
