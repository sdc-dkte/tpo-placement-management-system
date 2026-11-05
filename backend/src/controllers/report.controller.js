const { getStudentReport, getPaginatedStudentReport } = require("../services/report.service");
const { generateStudentReportPDF } = require("../services/report-pdf.service");
const { generateStudentReportExcel } = require("../services/report-excel.service");
const ValidationError = require("../utils/ValidationError");

const getAllStudents = async (req, res) => {
  try {
    const { page, limit, ...filters } = req.query;

    const reportData = await getPaginatedStudentReport(filters, page, limit);

    return res.status(200).json({
      success: true,
      count: reportData.data.length,
      total: reportData.total,
      page: reportData.page,
      limit: reportData.limit,
      totalPages: reportData.totalPages,
      data: reportData.data,
    });
  } catch (err) {
    console.error("Student report error:", err);
    if (err instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student report",
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

    // 4. Handle PDF stream errors
    pdfDoc.on("error", (err) => {
      console.error("PDF stream error:", err);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Failed to generate PDF report",
        });
      } else {
        res.destroy(err);
      }
    });

    // 5. Handle response errors
    res.on("error", (err) => {
      console.error("PDF response error:", err);
    });

    // 4. Send PDF to the browser
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    if (res.headersSent) {
      return res.destroy(err);
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate PDF report",
    });
  }
};

const exportStudentReportExcel = async (req, res) => {
  try {
    // 1. Fetch students using existing search and filters
    const students = await getStudentReport(req.query);
    console.log("Students received by Excel service:", students.length);

    // 2. Generate Excel workbook
    const workbook = await generateStudentReportExcel(students, req.query);

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
    console.log(err);
    if (res.headersSent) {
      return res.destroy(err);
    }

    if (err instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to generate Excel report",
    });
  }
};

module.exports = {
  getAllStudents,
  exportStudentReportPDF,
  exportStudentReportExcel,
};
