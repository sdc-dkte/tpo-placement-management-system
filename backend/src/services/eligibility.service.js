const prisma = require("../prismaClient");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Throws a structured error without touching the database.
 */
const fail = (message, statusCode) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    throw err;
};

// ---------------------------------------------------------------------------
// Core Eligibility Rule Engine
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a single student object satisfies all eligibility rules.
 *
 * This is a pure function — no database calls, easy to unit-test.
 *
 * @param {Object}   student           - Prisma Student record (with department & selection relations).
 * @param {Object}   criteria          - EligibilityCriteria record from Prisma (or null/undefined).
 * @param {number[]} eligibleBranchIds - Department IDs configured as eligible for the drive.
 * @param {number[]} eligibleYears     - Graduation years configured as eligible for the drive.
 * @returns {{ isEligible: boolean, reasons: string[] }}
 */
const evaluateStudentEligibility = (
    student,
    criteria,
    eligibleBranchIds = [],
    eligibleYears = []
) => {
    const reasons = [];

    // Guard: student must be a valid object
    if (!student || typeof student !== "object") {
        return { isEligible: false, reasons: ["Invalid student data supplied to eligibility engine."] };
    }

    // 1. Department / Branch restriction
    if (Array.isArray(eligibleBranchIds) && eligibleBranchIds.length > 0) {
        if (!eligibleBranchIds.includes(student.departmentId)) {
            reasons.push(
                `Student's department (ID: ${student.departmentId}) is not eligible for this drive.`
            );
        }
    }

    // 2. Graduation year restriction
    if (Array.isArray(eligibleYears) && eligibleYears.length > 0) {
        if (!eligibleYears.includes(student.graduationYear)) {
            reasons.push(
                `Graduation year (${student.graduationYear}) is not eligible for this drive.`
            );
        }
    }

    if (criteria && typeof criteria === "object") {
        // 3. Minimum CGPA
        const minCGPA = Number(criteria.minimumCGPA ?? 0);
        if (minCGPA > 0) {
            if (student.CGPA === null || student.CGPA === undefined) {
                reasons.push("CGPA is not recorded — cannot verify minimum CGPA requirement.");
            } else if (Number(student.CGPA) < minCGPA) {
                reasons.push(
                    `CGPA (${student.CGPA}) is below the required minimum of ${minCGPA}.`
                );
            }
        }

        // 4. Minimum 10th percentage
        const minTenth = Number(criteria.minimumTenth ?? 0);
        if (minTenth > 0) {
            if (student.tenthPercentage === null || student.tenthPercentage === undefined) {
                reasons.push(
                    "10th percentage is not recorded — cannot verify minimum 10th requirement."
                );
            } else if (Number(student.tenthPercentage) < minTenth) {
                reasons.push(
                    `10th percentage (${student.tenthPercentage}%) is below the required minimum of ${minTenth}%.`
                );
            }
        }

        // 5. Pathway-specific check (HSC → 12th | DIPLOMA → diploma %)
        if (student.academicPathway === "HSC") {
            const minTwelfth =
                criteria.minimumTwelfth !== null && criteria.minimumTwelfth !== undefined
                    ? Number(criteria.minimumTwelfth)
                    : 0;
            if (minTwelfth > 0) {
                if (
                    student.twelfthPercentage === null ||
                    student.twelfthPercentage === undefined
                ) {
                    reasons.push(
                        "12th percentage is not recorded — cannot verify minimum 12th requirement."
                    );
                } else if (Number(student.twelfthPercentage) < minTwelfth) {
                    reasons.push(
                        `12th percentage (${student.twelfthPercentage}%) is below the required minimum of ${minTwelfth}%.`
                    );
                }
            }
        } else if (student.academicPathway === "DIPLOMA") {
            const minDiploma =
                criteria.minimumDiplomaPercentage !== null &&
                criteria.minimumDiplomaPercentage !== undefined
                    ? Number(criteria.minimumDiplomaPercentage)
                    : 0;
            if (minDiploma > 0) {
                if (
                    student.diplomaPercentage === null ||
                    student.diplomaPercentage === undefined
                ) {
                    reasons.push(
                        "Diploma percentage is not recorded — cannot verify minimum diploma requirement."
                    );
                } else if (Number(student.diplomaPercentage) < minDiploma) {
                    reasons.push(
                        `Diploma percentage (${student.diplomaPercentage}%) is below the required minimum of ${minDiploma}%.`
                    );
                }
            }
        }

        // 6. Active backlogs
        const maxBacklogs = Number(criteria.maximumBacklogs ?? 0);
        const currentBacklogs = Number(student.activeBacklogs ?? 0);
        if (currentBacklogs > maxBacklogs) {
            reasons.push(
                `Active backlogs (${currentBacklogs}) exceed the maximum allowed (${maxBacklogs}).`
            );
        }

        // 7. Previous placement restriction
        if (criteria.allowPreviousPlacement === false) {
            const hasSelection = Boolean(
                student.selection ||
                    (Array.isArray(student.driveParticipations) &&
                        student.driveParticipations.some(
                            (p) => p.processStatus === "SELECTED"
                        ))
            );
            if (hasSelection) {
                reasons.push(
                    "Student has already been placed and this drive does not permit previously placed students."
                );
            }
        }
    }

    return { isEligible: reasons.length === 0, reasons };
};

// ---------------------------------------------------------------------------
// Batch evaluation — TPO use-case
// ---------------------------------------------------------------------------

/**
 * Calculates eligible students for a specific placement drive.
 * Supports filtering by department / year / name search and pagination.
 *
 * Authorization note: This function returns academic marks.
 * Callers MUST ensure only TPO roles can reach it.
 */
const getEligibleStudentsForDrive = async (rawDriveId, options = {}) => {
    const driveId = parseInt(rawDriveId, 10);
    if (!Number.isInteger(driveId) || driveId <= 0) {
        fail('"driveId" must be a positive integer.', 400);
    }

    const {
        page = 1,
        limit = 50,
        search = "",
        departmentId,
        graduationYear,
        statusFilter = "eligible_only", // "eligible_only" | "ineligible_only" | "all"
    } = options;

    // Validate statusFilter
    const ALLOWED_FILTERS = ["eligible_only", "ineligible_only", "all"];
    const resolvedFilter = String(statusFilter).toLowerCase();
    if (!ALLOWED_FILTERS.includes(resolvedFilter)) {
        fail(
            `Invalid statusFilter "${statusFilter}". Allowed: ${ALLOWED_FILTERS.join(", ")}.`,
            400
        );
    }

    // Optional coarse filters
    if (departmentId !== undefined) {
        const id = parseInt(departmentId, 10);
        if (!Number.isInteger(id) || id <= 0)
            fail('"departmentId" must be a positive integer.', 400);
    }
    if (graduationYear !== undefined) {
        const yr = parseInt(graduationYear, 10);
        if (!Number.isInteger(yr) || yr < 2000 || yr > 2100)
            fail('"graduationYear" must be a valid year between 2000 and 2100.', 400);
    }

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveId },
        include: {
            company: { select: { id: true, name: true } },
            jobRole: { select: { id: true, title: true } },
            eligibilityCriteria: true,
            eligibleBranches: {
                include: { department: { select: { id: true, name: true, code: true } } },
            },
            eligibleYears: true,
        },
    });

    if (!drive) return null;

    const eligibleBranchIds = drive.eligibleBranches.map((b) => b.departmentId);
    const eligibleYears = drive.eligibleYears.map((y) => y.graduationYear);
    const criteria = drive.eligibilityCriteria;

    // Build coarse DB filter
    const where = {};
    if (departmentId !== undefined) where.departmentId = parseInt(departmentId, 10);
    if (graduationYear !== undefined) where.graduationYear = parseInt(graduationYear, 10);

    if (search && String(search).trim() !== "") {
        const term = String(search).trim();
        where.OR = [
            { PRN: { contains: term, mode: "insensitive" } },
            { user: { name: { contains: term, mode: "insensitive" } } },
            { user: { email: { contains: term, mode: "insensitive" } } },
        ];
    }

    const candidates = await prisma.student.findMany({
        where,
        include: {
            // NOTE: only the logged-in TPO sees academic fields via this endpoint
            user: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true, code: true } },
            selection: { select: { id: true, driveId: true, status: true, packageLPA: true } },
        },
        orderBy: [{ CGPA: "desc" }, { PRN: "asc" }],
    });

    // Run evaluation engine
    const evaluated = candidates.map((student) => {
        const result = evaluateStudentEligibility(
            student,
            criteria,
            eligibleBranchIds,
            eligibleYears
        );
        return {
            studentId: student.id,
            userId: student.userId,
            PRN: student.PRN,
            name: student.user?.name ?? "",
            email: student.user?.email ?? "",
            departmentId: student.departmentId,
            department: student.department?.name ?? "",
            departmentCode: student.department?.code ?? "",
            graduationYear: student.graduationYear,
            academicPathway: student.academicPathway,
            CGPA: student.CGPA,
            tenthPercentage: student.tenthPercentage,
            twelfthPercentage: student.twelfthPercentage,
            diplomaPercentage: student.diplomaPercentage,
            activeBacklogs: student.activeBacklogs,
            isPlaced: Boolean(student.selection),
            isEligible: result.isEligible,
            reasons: result.reasons,
        };
    });

    const eligibleCount = evaluated.filter((s) => s.isEligible).length;
    const ineligibleCount = evaluated.length - eligibleCount;

    let filtered = evaluated;
    if (resolvedFilter === "eligible_only") filtered = evaluated.filter((s) => s.isEligible);
    else if (resolvedFilter === "ineligible_only") filtered = evaluated.filter((s) => !s.isEligible);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const total = filtered.length;
    const startIndex = (pageNum - 1) * limitNum;

    return {
        drive: {
            id: drive.id,
            title: drive.title,
            companyName: drive.company.name,
            jobRoleTitle: drive.jobRole.title,
            status: drive.status,
            packageLPA: drive.packageLPA,
        },
        criteria: {
            minimumCGPA: criteria?.minimumCGPA ?? 0,
            minimumTenth: criteria?.minimumTenth ?? 0,
            minimumTwelfth: criteria?.minimumTwelfth ?? null,
            minimumDiplomaPercentage: criteria?.minimumDiplomaPercentage ?? null,
            maximumBacklogs: criteria?.maximumBacklogs ?? 0,
            allowPreviousPlacement: criteria?.allowPreviousPlacement ?? false,
            eligibleDepartments: drive.eligibleBranches.map((b) => ({
                id: b.department.id,
                name: b.department.name,
                code: b.department.code,
            })),
            eligibleGraduationYears: eligibleYears,
        },
        summary: { totalEvaluated: evaluated.length, eligibleCount, ineligibleCount },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
        },
        data: filtered.slice(startIndex, startIndex + limitNum),
    };
};

// ---------------------------------------------------------------------------
// Single-student eligibility check
// ---------------------------------------------------------------------------

/**
 * Checks a single student's eligibility for a drive.
 *
 * Authorization notes:
 *  - Students may only check their OWN eligibility; enforce at the controller.
 *  - Academic details are NOT returned here — only isEligible + reasons.
 *
 * @param {number|string} studentId
 * @param {number|string} driveId
 */
const checkStudentDriveEligibility = async (rawStudentId, rawDriveId) => {
    const studentId = parseInt(rawStudentId, 10);
    const driveId = parseInt(rawDriveId, 10);

    if (!Number.isInteger(studentId) || studentId <= 0) {
        fail('"studentId" must be a positive integer.', 400);
    }
    if (!Number.isInteger(driveId) || driveId <= 0) {
        fail('"driveId" must be a positive integer.', 400);
    }

    const [drive, student] = await Promise.all([
        prisma.placementDrive.findUnique({
            where: { id: driveId },
            include: {
                eligibilityCriteria: true,
                eligibleBranches: { select: { departmentId: true } },
                eligibleYears: { select: { graduationYear: true } },
            },
        }),
        prisma.student.findUnique({
            where: { id: studentId },
            include: {
                department: { select: { id: true, name: true } },
                selection: { select: { id: true, status: true } },
            },
        }),
    ]);

    if (!drive) return { notFound: true, message: "Placement drive not found." };
    if (!student) return { notFound: true, message: "Student record not found." };

    const eligibleBranchIds = drive.eligibleBranches.map((b) => b.departmentId);
    const eligibleYears = drive.eligibleYears.map((y) => y.graduationYear);

    const result = evaluateStudentEligibility(
        student,
        drive.eligibilityCriteria,
        eligibleBranchIds,
        eligibleYears
    );

    // Return only isEligible + reasons — no sensitive academic data exposed
    return {
        driveId: drive.id,
        driveTitle: drive.title,
        driveStatus: drive.status,
        isEligible: result.isEligible,
        reasons: result.reasons,
    };
};

module.exports = {
    evaluateStudentEligibility,
    getEligibleStudentsForDrive,
    checkStudentDriveEligibility,
};
