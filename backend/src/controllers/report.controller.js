const { getStudentReport } = require("../services/report.service");
const { generateStudentReportPDF } = require("../services/report-pdf.service");
const { generateStudentReportExcel } = require("../services/report-excel.service");

const getAllStudents = async (req, res) => {
  try {
    const reportData = await getStudentReport(req.query);

    return res.status(200).json({
      success: true,
      count: reportData.length,
      data: reportData,
    });
  } catch (err) {
    console.error("Error fetching student report:", err);

    const isValidationError =
      err.message.startsWith("Invalid batch") ||
      err.message.startsWith("Invalid academic year") ||
      err.message.startsWith("Invalid placement status");

    return res.status(isValidationError ? 400 : 500).json({
      success: false,
      message: isValidationError ? err.message : "Failed to fetch student report",
    });
  }
};

const exportStudentReportPDF = async (req, res) => {
  try {
    // 1. Fetch students using the existing filters
    const students = await getStudentReport(req.query);

    // 2. Generate PDF document
    const pdfDoc = await generateStudentReportPDF(students, req.query);

    // 3. Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="student-placement-report.pdf"');

    // 4. Send PDF to the browser
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("PDF export error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate PDF report",
      });
    }
  }
};

const exportStudentReportExcel = async (req, res) => {
  try {
    // 1. Fetch students using existing search and filters
    const students = await getStudentReport(req.query);

    // 2. Generate Excel workbook
    const workbook = await generateStudentReportExcel(students);

    // 3. Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader("Content-Disposition", 'attachment; filename="student-placement-report.xlsx"');

    // 4. Write Excel file to response
    await workbook.xlsx.write(res);

    res.end();
  } catch (err) {
    console.error("Excel export error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate Excel report",
      });
    }
  }
};

module.exports = {
  getAllStudents,
  exportStudentReportPDF,
  exportStudentReportExcel,
};
