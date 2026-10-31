const { getStudentReport } = require("../services/report.service");

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

module.exports = {
  getAllStudents,
};
