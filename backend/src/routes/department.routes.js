
const express = require("express");

const {
    getDepartments,
    getDepartmentById,
    getDepartmentStudents,
} = require("../controllers/department.controller");

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const router = express.Router();

// TPO and students can view departments.
router.get(
    "/",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getDepartments
);

router.get(
    "/:departmentId",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getDepartmentById
);

// Only TPO can access department-wise student records.
router.get(
    "/:departmentId/students",
    authenticateToken,
    allowRoles("TPO"),
    getDepartmentStudents
);

module.exports = router;
