const prisma = require("../prismaClient");
const driveService = require("../services/drive.service");
const eligibilityService = require("../services/eligibility.service");

/**
 * Handles creation of a new placement drive.
 * POST /api/v1/drives
 */
const createDrive = async (req, res) => {
    try {
        const { companyId, jobRoleId, title, packageLPA } = req.body;

        if (!companyId || !jobRoleId || !title || packageLPA === undefined) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: companyId, jobRoleId, title, and packageLPA are compulsory.",
            });
        }

        const drive = await driveService.createPlacementDrive(req.body);

        return res.status(201).json({
            success: true,
            message: "Placement drive created successfully.",
            data: drive,
        });
    } catch (error) {
        console.error("Error creating placement drive:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to create placement drive.",
        });
    }
};

/**
 * Lists drives with filtering, pagination, and search.
 * GET /api/v1/drives
 */
const getDrives = async (req, res) => {
    try {
        const result = await driveService.getAllPlacementDrives(req.query);

        return res.status(200).json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error("Error retrieving placement drives:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to retrieve placement drives.",
        });
    }
};

/**
 * Retrieves details for a specific drive.
 * GET /api/v1/drives/:driveId
 */
const getDriveById = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
        const drive = await driveService.getPlacementDriveById(driveId);

        if (!drive) {
            return res.status(404).json({
                success: false,
                message: `Placement drive with ID ${driveId} not found.`,
            });
        }

        // If a student is requesting, evaluate their personal eligibility
        if (req.user && req.user.role === "STUDENT") {
            const student = await prisma.student.findUnique({
                where: { userId: req.user.id },
                select: { id: true },
            });

            if (student) {
                const eligibility = await eligibilityService.checkStudentDriveEligibility(
                    student.id,
                    drive.id
                );
                drive.myEligibility = {
                    isEligible: eligibility.isEligible,
                    reasons: eligibility.reasons,
                };
            }
        }

        return res.status(200).json({
            success: true,
            data: drive,
        });
    } catch (error) {
        console.error("Error retrieving drive details:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to retrieve drive details.",
        });
    }
};

/**
 * Updates drive details and/or eligibility criteria.
 * PATCH /api/v1/drives/:driveId
 */
const updateDrive = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
        const updated = await driveService.updatePlacementDrive(driveId, req.body);

        return res.status(200).json({
            success: true,
            message: "Placement drive updated successfully.",
            data: updated,
        });
    } catch (error) {
        console.error("Error updating placement drive:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to update placement drive.",
        });
    }
};

/**
 * Updates drive status lifecycle.
 * PATCH /api/v1/drives/:driveId/status
 */
const updateDriveStatus = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required in request body.",
            });
        }

        const result = await driveService.updatePlacementDriveStatus(driveId, status);

        return res.status(200).json({
            success: true,
            message: "Drive status updated successfully.",
            data: result,
        });
    } catch (error) {
        console.error("Error updating drive status:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to update drive status.",
        });
    }
};

/**
 * Gets eligibility criteria for a specific drive.
 * GET /api/v1/drives/:driveId/eligibility-criteria
 */
const getEligibilityCriteria = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
        const drive = await driveService.getPlacementDriveById(driveId);

        if (!drive) {
            return res.status(404).json({
                success: false,
                message: `Placement drive with ID ${driveId} not found.`,
            });
        }

        if (!drive.eligibilityCriteria) {
            return res.status(404).json({
                success: false,
                message: "Eligibility criteria not found for this drive.",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                driveId: drive.id,
                ...drive.eligibilityCriteria,
            },
        });
    } catch (error) {
        console.error("Error retrieving eligibility criteria:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to retrieve eligibility criteria.",
        });
    }
};

/**
 * Replaces drive eligibility criteria atomically.
 * PUT /api/v1/drives/:driveId/eligibility-criteria
 */
const replaceEligibilityCriteria = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
        const result = await driveService.replaceEligibilityCriteria(driveId, req.body);

        return res.status(200).json({
            success: true,
            message: "Eligibility criteria replaced successfully.",
            data: result,
        });
    } catch (error) {
        console.error("Error replacing eligibility criteria:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to replace eligibility criteria.",
        });
    }
};

/**
 * Dynamic Eligibility Engine endpoint: Calculates eligible students for a drive.
 * GET /api/v1/drives/:driveId/eligible-students
 */
const getEligibleStudents = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;
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
        console.error("Error calculating eligible students:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to calculate eligible students.",
        });
    }
};

/**
 * Checks current logged-in student's eligibility for a drive.
 * GET /api/v1/drives/:driveId/eligibility/me
 */
const getMyEligibility = async (req, res) => {
    try {
        const driveId = req.params.driveId || req.params.id;

        const student = await prisma.student.findUnique({
            where: { userId: req.user.id },
            select: { id: true },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "No student profile linked to current account.",
            });
        }

        const result = await eligibilityService.checkStudentDriveEligibility(
            student.id,
            driveId
        );

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
        console.error("Error checking student eligibility:", error);
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to check student eligibility.",
        });
    }
};

module.exports = {
    createDrive,
    getDrives,
    getDriveById,
    updateDrive,
    updateDriveStatus,
    getEligibilityCriteria,
    replaceEligibilityCriteria,
    getEligibleStudents,
    getMyEligibility,
};
