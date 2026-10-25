
const express = require("express");
const router = express.Router();

const {
    getStudents,
    getStudentById,
    getMyProfile,
    getMyDrives,
    getMyPlacements
} = require("../controllers/student.controller");

const authenticate = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/role.middleware");

// Register /me before /:studentId to avoid route conflicts.
router.get(
    "/me",
    authenticate,
    authorizeRole("STUDENT"),
    getMyProfile
);

router.get("/", authenticate, authorizeRole("TPO"), getStudents);
router.get("/:studentId", authenticate, authorizeRole("TPO"), getStudentById);

router.get(
    "/me/drives",
    authenticate,
    authorizeRole("STUDENT"),
    getMyDrives
);



router.get(
    "/me/placements",
    authenticate,
    authorizeRole("STUDENT"),
    getMyPlacements
);




module.exports = router;




