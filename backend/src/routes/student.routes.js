const express = require("express");
const router = express.Router();

const {
    createStudent,
    getStudents,
    getStudentById,
    getMyProfile,
    getMyDrives,
    getMyPlacements,
    updateStudent,
    updateStudentAccountStatus,
} = require("../controllers/student.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/role.middleware");

// Require authentication for all student routes.
router.use(authenticate);

// Student-only routes: register before /:studentId.
router.get("/me", authorizeRole("STUDENT"), getMyProfile);
router.get("/me/drives", authorizeRole("STUDENT"), getMyDrives);
router.get("/me/placements", authorizeRole("STUDENT"), getMyPlacements);

// TPO-only routes.
router.post("/", authorizeRole("TPO"), createStudent);
router.get("/", authorizeRole("TPO"), getStudents);
router.get("/:studentId", authorizeRole("TPO"), getStudentById);
router.patch("/:studentId", authorizeRole("TPO"), updateStudent);
router.patch("/:id/status", authorizeRole("TPO"), updateStudentAccountStatus);

module.exports = router;
