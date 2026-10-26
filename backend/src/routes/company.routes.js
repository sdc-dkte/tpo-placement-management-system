
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const {
    getCompanies,
    createCompany,
    getCompanyById,
    updateCompany,
    getCompanyPlacements,
} = require("../controllers/company.controller");

// List companies: TPO and STUDENT
router.get("/", authenticateToken, allowRoles("TPO", "STUDENT"), getCompanies);

// Create company: TPO only
router.post("/", authenticateToken, allowRoles("TPO"), createCompany);

// Company placements: TPO only
router.get(
    "/:companyId/placements",
    authenticateToken,
    allowRoles("TPO"),
    getCompanyPlacements
);

// Company details: TPO and STUDENT
router.get(
    "/:companyId",
    authenticateToken,
    allowRoles("TPO", "STUDENT"),
    getCompanyById
);

// Update company: TPO only
router.patch(
    "/:companyId",
    authenticateToken,
    allowRoles("TPO"),
    updateCompany
);

module.exports = router;
