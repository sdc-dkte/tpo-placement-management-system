
const express = require("express");
const router = express.Router();

const {
    getOverview,
    getDepartmentOverview
} = require("../controllers/dashboard.controller");
const authenticate = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/role.middleware");

router.get(
    "/overview",
    authenticate,
    authorizeRole("TPO"),
    getOverview
);

router.get(
    "/departments/:departmentId",
    authenticate,
    authorizeRole("TPO"),
    getDepartmentOverview
);

module.exports = router;
