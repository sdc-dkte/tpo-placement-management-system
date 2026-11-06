
const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const {
  getOverview,
  getMonthly,
  getDepartments,
  getCompanies,
  getYearly
} = require("../controllers/analytics.controller");

// All Analytics APIs require authentication and TPO access.
router.use(authenticateToken);
router.use(allowRoles("TPO"));

router.get("/overview", getOverview);
router.get("/monthly", getMonthly);
router.get("/departments", getDepartments);
router.get("/companies", getCompanies);
router.get("/yearly", getYearly);

module.exports = router;
