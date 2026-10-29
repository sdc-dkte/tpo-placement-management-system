
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const {
    getCompanyJobRoles,
    createCompanyJobRole,
    getJobRoleById,
    updateJobRole,
    deleteJobRole,
} = require("../controllers/jobRole.controller");

// List job roles belonging to a company
router.get(
    "/companies/:companyId/job-roles",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getCompanyJobRoles
);

// Create a job role under a company (TPO only)
router.post(
    "/companies/:companyId/job-roles",
    authenticateToken,
    allowRoles("TPO"),
    createCompanyJobRole
);

// View a particular job role
router.get(
    "/job-roles/:jobRoleId",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getJobRoleById
);

// Update a job role (TPO only)
router.patch(
    "/job-roles/:jobRoleId",
    authenticateToken,
    allowRoles("TPO"),
    updateJobRole
);

// Delete a job role (TPO only)
router.delete(
    "/job-roles/:jobRoleId",
    authenticateToken,
    allowRoles("TPO"),
    deleteJobRole
);

module.exports = router;
