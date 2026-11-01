const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");

const {
  getAllStudents,
  exportStudentReportPDF,
  exportStudentReportExcel,
} = require("../controllers/report.controller");

// Get student reports
router.get("/", getAllStudents);

// Export student reports as PDF
router.get("/export/pdf", exportStudentReportPDF);

// Export student reports as Excel
router.get("/export/excel", exportStudentReportExcel);

module.exports = router;
