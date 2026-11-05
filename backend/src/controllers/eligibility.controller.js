const prisma = require("../prismaClient");
const eligibilityService = require("../services/eligibility.service");

/**
 * Evaluates candidate students for a drive.
 * GET /api/v1/eligibility/drives/:driveId/students
 */
const getDriveEligibleStudents = async (req, res) => {
    try {
        const { driveId } = req.params;
        const result = await eligibilityService.getEligibleStudentsForDrive(driveId, req.query);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: `Placement drive with ID ${driveId} not found.`,
            });
        }

        return res.status(200).json({
            success: true,
            drive: result.drive,
            criteria: result.criteria,
            summary: result.summary,
            pagination: result.pagination,
            data: result.data,
        });
    } catch (error) {
        console.error("Eligibility controller error:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to calculate eligible students.",
        });
    }
};

/**
 * Checks a specific student's eligibility for a specific drive.
 * GET /api/v1/eligibility/drives/:driveId/students/:studentId
 */
const checkSpecificStudentEligibility = async (req, res) => {
    try {
        const { driveId, studentId } = req.params;

        const result = await eligibilityService.checkStudentDriveEligibility(
            studentId,
            driveId
        );

        if (result.error) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        if (result.notFound) {
            return res.status(404).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Eligibility check error:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to check student eligibility.",
        });
    }
};

module.exports = {
    getDriveEligibleStudents,
    checkSpecificStudentEligibility,
};
