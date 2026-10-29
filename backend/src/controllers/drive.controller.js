const prisma = require("../prismaClient");
const driveService = require("../services/drive.service");
const eligibilityService = require("../services/eligibility.service");

// ---------------------------------------------------------------------------
// Drive CRUD
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/drives
 * Creates a new placement drive with optional eligibility criteria.
 * Access: TPO only.
 */
const createDrive = async (req, res) => {
    try {
        const drive = await driveService.createPlacementDrive(req.body);
        return res.status(201).json({
            success: true,
            message: "Placement drive created successfully.",
            data: drive,
        });
    } catch (error) {
        console.error("createDrive error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to create placement drive.",
        });
    }
};

/**
 * GET /api/v1/drives
 * Lists drives with optional filtering, search, and pagination.
 * Access: TPO and STUDENT.
 *
 * Students see the same drive list but WITHOUT eligible-student counts;
 * counts are a TPO-only concern and are stripped here for STUDENT callers.
 */
const getDrives = async (req, res) => {
    try {
        const result = await driveService.getAllPlacementDrives(req.query);

        // Strip TPO-only fields for student callers
        let data = result.data;
        if (req.user.role === "STUDENT") {
            data = data.map(({ participationsCount, selectionsCount, ...rest }) => rest);
        }

        return res.status(200).json({
            success: true,
            data,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error("getDrives error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to retrieve placement drives.",
        });
    }
};

/**
 * GET /api/v1/drives/:driveId
 * Retrieves full details for a specific drive.
 * Access: TPO and STUDENT.
 *
 * Students additionally receive their personal eligibility result
 * (isEligible + reasons) without exposing other students' academic data.
 */
const getDriveById = async (req, res) => {
    try {
        const { driveId } = req.params;
        const drive = await driveService.getPlacementDriveById(driveId);

        if (!drive) {
            return res.status(404).json({
                success: false,
                message: `Placement drive with ID ${driveId} not found.`,
            });
        }

        // Strip participant/selection counts for students
        if (req.user.role === "STUDENT") {
            delete drive.counts;
        }

        // Append personal eligibility only for the requesting student
        if (req.user.role === "STUDENT") {
            const student = await prisma.student.findUnique({
                where: { userId: req.user.id },
                select: { id: true },
            });

            if (student) {
                const eligResult = await eligibilityService.checkStudentDriveEligibility(
                    student.id,
                    drive.id
                );
                // Only attach isEligible + reasons — no other student's data
                drive.myEligibility = {
                    isEligible: eligResult.isEligible,
                    reasons: eligResult.reasons,
                };
            }
        }

        return res.status(200).json({ success: true, data: drive });
    } catch (error) {
        console.error("getDriveById error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to retrieve drive details.",
        });
    }
};

/**
 * PATCH /api/v1/drives/:driveId
 * Partial update: drive fields and/or eligibility criteria.
 * Access: TPO only.
 */
const updateDrive = async (req, res) => {
    try {
        const { driveId } = req.params;
        const updated = await driveService.updatePlacementDrive(driveId, req.body);
        return res.status(200).json({
            success: true,
            message: "Placement drive updated successfully.",
            data: updated,
        });
    } catch (error) {
        console.error("updateDrive error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to update placement drive.",
        });
    }
};

// ---------------------------------------------------------------------------
// Status Management
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/drives/:driveId/status
 * Updates drive lifecycle status with strict transition validation.
 * Access: TPO only.
 *
 * If the transition is invalid, the drive record is never written.
 */
const updateDriveStatus = async (req, res) => {
    try {
        const { driveId } = req.params;
        const { status } = req.body;

        if (!status || !String(status).trim()) {
            return res.status(400).json({
                success: false,
                message: '"status" is required in the request body.',
            });
        }

        const result = await driveService.updatePlacementDriveStatus(driveId, status);
        return res.status(200).json({
            success: true,
            message: "Drive status updated successfully.",
            data: result,
        });
    } catch (error) {
        console.error("updateDriveStatus error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to update drive status.",
        });
    }
};

// ---------------------------------------------------------------------------
// Eligibility Criteria
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/drives/:driveId/eligibility-criteria
 * Returns eligibility criteria, allowed departments, and graduation years.
 * Access: TPO and STUDENT.
 */
const getEligibilityCriteria = async (req, res) => {
    try {
        const { driveId } = req.params;
        const drive = await driveService.getPlacementDriveById(driveId);

        if (!drive) {
            return res.status(404).json({
                success: false,
                message: `Placement drive with ID ${driveId} not found.`,
            });
        }

        return res.status(200).json({
            success: true,
            data: { driveId: drive.id, ...drive.eligibility },
        });
    } catch (error) {
        console.error("getEligibilityCriteria error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to retrieve eligibility criteria.",
        });
    }
};

/**
 * PUT /api/v1/drives/:driveId/eligibility-criteria
 * Atomically replaces all eligibility criteria, branches, and years.
 * Access: TPO only.
 */
const replaceEligibilityCriteria = async (req, res) => {
    try {
        const { driveId } = req.params;
        const result = await driveService.replaceEligibilityCriteria(driveId, req.body);
        return res.status(200).json({
            success: true,
            message: "Eligibility criteria replaced successfully.",
            data: result,
        });
    } catch (error) {
        console.error("replaceEligibilityCriteria error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to replace eligibility criteria.",
        });
    }
};

// ---------------------------------------------------------------------------
// Eligibility Engine — Report endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/drives/:driveId/eligible-students
 * Dynamic Eligibility Engine: returns eligible student list with full academic data.
 * Access: TPO only — students MUST NOT be able to see other students' academic records.
 */
const getEligibleStudents = async (req, res) => {
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
        console.error("getEligibleStudents error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to calculate eligible students.",
        });
    }
};

/**
 * GET /api/v1/drives/:driveId/eligibility/me
 * Returns the logged-in student's personal eligibility for a drive.
 * Access: STUDENT only.
 *
 * Only returns isEligible + reasons for the requesting student.
 * No other student's data is ever returned.
 */
const getMyEligibility = async (req, res) => {
    try {
        const { driveId } = req.params;

        // Look up the student profile for the authenticated user
        const student = await prisma.student.findUnique({
            where: { userId: req.user.id },
            select: { id: true },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "No student profile is linked to your account.",
            });
        }

        // checkStudentDriveEligibility returns only isEligible + reasons (no academic data leakage)
        const result = await eligibilityService.checkStudentDriveEligibility(
            student.id,
            driveId
        );

        if (result.notFound) {
            return res.status(404).json({ success: false, message: result.message });
        }

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error("getMyEligibility error:", error.message);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to check your eligibility.",
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
