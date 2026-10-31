const prisma = require("../prismaClient");

/**
 * Evaluates whether a student meets the criteria for a placement drive.
 *
 * @param {Object} student - Student record including department, selection, etc.
 * @param {Object} criteria - EligibilityCriteria model instance
 * @param {Array<number>} eligibleBranchIds - Array of department IDs eligible for the drive
 * @param {Array<number>} eligibleYears - Array of graduation years eligible for the drive
 * @returns {{ isEligible: boolean, reasons: string[] }}
 */

const isValidNumber = (value, min, max) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max;

const evaluateStudentEligibility = (
    student,
    criteria = {},
    eligibleBranchIds = [],
    eligibleYears = []
) => {
    if (!student || typeof student !== "object") {
        return {
            isEligible: false,
            reasons: ["Student record is missing or invalid."],
        };
    }

    const reasons = [];

    // 1. Department / Branch Check
    if (Array.isArray(eligibleBranchIds) && eligibleBranchIds.length > 0) {
        if (!eligibleBranchIds.includes(student.departmentId)) {
            reasons.push("Student's department is not eligible for this drive.");
        }
    }

    // 2. Graduation Year Check
    if (Array.isArray(eligibleYears) && eligibleYears.length > 0) {
        if (!eligibleYears.includes(student.graduationYear)) {
            reasons.push(
                `Graduation year (${student.graduationYear}) is not eligible for this drive.`
            );
        }
    }

    if (criteria) {
        // 3. Minimum CGPA Check
        const minCGPA = criteria.minimumCGPA ?? 0;


        if (!isValidNumber(student.CGPA, 0, 10)) {
            reasons.push("CGPA is missing or invalid.");
        } else if (student.CGPA < minCGPA) {
            reasons.push(
                `CGPA (${student.CGPA}) is below the required minimum of ${minCGPA}.`
            );
        }

        // 4. Minimum 10th Percentage Check
        const minTenth = criteria.minimumTenth ?? 0;

        if (!isValidNumber(student.tenthPercentage, 0, 100)) {
            reasons.push("10th percentage is missing or invalid.");
        } else if (student.tenthPercentage < minTenth) {
            reasons.push(
                `10th percentage (${student.tenthPercentage}%) is below the required minimum of ${minTenth}%.`
            );
        }

        // 5. Pathway Specific Check (12th / Diploma)

        if (!["HSC", "DIPLOMA"].includes(student.academicPathway)) {
            reasons.push("Academic pathway is missing or invalid.");
        }

        if (student.academicPathway === "HSC") {
            const minTwelfth = criteria.minimumTwelfth;
            const percentage = student.twelfthPercentage;

            if (minTwelfth !== null && minTwelfth !== undefined && minTwelfth > 0) {
                if (
                    typeof percentage !== "number" ||
                    !Number.isFinite(percentage) ||
                    percentage < 0 ||
                    percentage > 100
                ) {
                    reasons.push("12th percentage is missing or invalid.");
                } else if (percentage < minTwelfth) {
                    reasons.push(
                        `12th percentage (${percentage}%) is below the required minimum of ${minTwelfth}%.`
                    );
                }
            }
        } else if (student.academicPathway === "DIPLOMA") {
            const minDiploma = criteria.minimumDiplomaPercentage;
            const percentage = student.diplomaPercentage;

            if (
                minDiploma !== null &&
                minDiploma !== undefined &&
                minDiploma > 0
            ) {
                if (
                    typeof percentage !== "number" ||
                    !Number.isFinite(percentage) ||
                    percentage < 0 ||
                    percentage > 100
                ) {
                    reasons.push("Diploma percentage is missing or invalid.");
                } else if (percentage < minDiploma) {
                    reasons.push(
                        `Diploma percentage (${percentage}%) is below the required minimum of ${minDiploma}%.`
                    );
                }
            }
        }

        // 6. Active Backlogs Check
        const maxBacklogs = criteria.maximumBacklogs ?? 0;
        const currentBacklogs = student.activeBacklogs;

        if (
            !Number.isInteger(currentBacklogs) ||
            currentBacklogs < 0
        ) {
            reasons.push("Active backlog information is missing or invalid.");
        } else if (currentBacklogs > maxBacklogs) {
            reasons.push(
                `Active backlogs (${currentBacklogs}) exceed the maximum allowed (${maxBacklogs}).`
            );
        }



        // 7. Previous Placement / Single Offer Policy Check
        if (criteria.allowPreviousPlacement === false) {
            const hasSelection = student.selection != null;

            if (hasSelection) {
                reasons.push(
                    "Student has already been placed and this drive does not permit previously placed students."
                );
            }
        }

    }

    return {
        isEligible: reasons.length === 0,
        reasons,
    };
};

/**
 * Calculates eligible students for a specific placement drive.
 * Supports filtering, searching, and pagination.
 */
const getEligibleStudentsForDrive = async (driveId, options = {}) => {
    const {
        page = 1,
        limit = 50,
        search = "",
        departmentId,
        graduationYear,
        statusFilter = "eligible_only", // "eligible_only" | "ineligible_only" | "all"
    } = options;

    const allowedStatusFilters = [
        "eligible_only",
        "ineligible_only",
        "all",
    ];

    if (!allowedStatusFilters.includes(statusFilter)) {
        const error = new Error("Invalid statusFilter.");
        error.statusCode = 400;
        throw error;
    }

    const driveIdNum = Number(driveId);

    if (!Number.isInteger(driveIdNum) || driveIdNum <= 0) {
        const error = new Error("Invalid driveId.");
        error.statusCode = 400;
        throw error;
    }

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
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

    if (!drive) {
        return null;
    }

    const eligibleBranchIds = drive.eligibleBranches.map((b) => b.departmentId);
    const eligibleYears = drive.eligibleYears.map((y) => y.graduationYear);
    const criteria = drive.eligibilityCriteria;

    // Build Prisma where clause for candidate students
    const where = {};


    if (departmentId !== undefined && departmentId !== null && String(departmentId).trim() !== "") {
        const id = Number(departmentId);

        if (!Number.isInteger(id) || id <= 0) {
            const error = new Error("Invalid departmentId.");
            error.statusCode = 400;
            throw error;
        }

        where.departmentId = id;
    }

    if (graduationYear !== undefined && graduationYear !== null && String(graduationYear).trim() !== "") {
        const year = Number(graduationYear);

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            const error = new Error("Invalid graduationYear.");
            error.statusCode = 400;
            throw error;
        }

        where.graduationYear = year;
    }

    if (typeof search !== "string") {
        const error = new Error("Invalid search parameter.");
        error.statusCode = 400;
        throw error;
    }


    if (search && search.trim() !== "") {
        const searchTerm = search.trim();
        where.OR = [
            { PRN: { contains: searchTerm, mode: "insensitive" } },
            { user: { name: { contains: searchTerm, mode: "insensitive" } } },
            { user: { email: { contains: searchTerm, mode: "insensitive" } } },
        ];
    }

    // Retrieve all candidates matching coarse filters, then run detailed rule engine
    const candidates = await prisma.student.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true, code: true } },
            selection: {
                select: { id: true, driveId: true, status: true, packageLPA: true },
            },
        },
        orderBy: [{ CGPA: "desc" }, { PRN: "asc" }],
    });

    // Run evaluation engine for all candidates
    const evaluated = candidates.map((student) => {
        const evaluation = evaluateStudentEligibility(
            student,
            criteria,
            eligibleBranchIds,
            eligibleYears
        );

        return {
            studentId: student.id,
            userId: student.userId,
            PRN: student.PRN,
            name: student.user?.name || "",
            email: student.user?.email || "",
            departmentId: student.departmentId,
            department: student.department?.name || "",
            departmentCode: student.department?.code || "",
            graduationYear: student.graduationYear,
            academicPathway: student.academicPathway,
            CGPA: student.CGPA,
            tenthPercentage: student.tenthPercentage,
            twelfthPercentage: student.twelfthPercentage,
            diplomaPercentage: student.diplomaPercentage,
            activeBacklogs: student.activeBacklogs,
            isPlaced: Boolean(student.selection),
            isEligible: evaluation.isEligible,
            reasons: evaluation.reasons,
        };
    });

    const eligibleCount = evaluated.filter((s) => s.isEligible).length;
    const ineligibleCount = evaluated.length - eligibleCount;

    // Filter by statusFilter
    let filteredList = evaluated;
    if (statusFilter === "eligible_only") {
        filteredList = evaluated.filter((s) => s.isEligible);
    } else if (statusFilter === "ineligible_only") {
        filteredList = evaluated.filter((s) => !s.isEligible);
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (
        !Number.isInteger(pageNum) ||
        pageNum < 1 ||
        !Number.isInteger(limitNum) ||
        limitNum < 1 ||
        limitNum > 100
    ) {
        const error = new Error("Invalid pagination parameters. Limit must be between 1 and 100.");
        error.statusCode = 400;
        throw error;
    }

    const total = filteredList.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;

    const paginatedList = filteredList.slice(
        startIndex,
        startIndex + limitNum
    );

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
        summary: {
            totalEvaluated: evaluated.length,
            eligibleCount,
            ineligibleCount,
        },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
        },
        data: paginatedList,
    };
};

/**
 * Checks eligibility for a student using Student ID.
 */
const checkStudentDriveEligibility = async (studentId, driveId) => {

    if (
        !Number.isInteger(Number(studentId)) ||
        Number(studentId) <= 0 ||
        !Number.isInteger(Number(driveId)) ||
        Number(driveId) <= 0
    ) {
        return {
            error: true,
            message: "Invalid student ID or drive ID.",
        };
    }

    const drive = await prisma.placementDrive.findUnique({
        where: { id: Number(driveId) },
        include: {
            eligibilityCriteria: true,
            eligibleBranches: true,
            eligibleYears: true,
        },
    });

    if (!drive) {
        return { notFound: true, message: "Placement drive not found." };
    }

    const student = await prisma.student.findUnique({
        where: { id: Number(studentId) },
        include: {
            department: true,
            selection: true,
        },
    });

    if (!student) {
        return { notFound: true, message: "Student record not found." };
    }

    const eligibleBranchIds = drive.eligibleBranches.map((b) => b.departmentId);
    const eligibleYears = drive.eligibleYears.map((y) => y.graduationYear);

    const evaluation = evaluateStudentEligibility(
        student,
        drive.eligibilityCriteria,
        eligibleBranchIds,
        eligibleYears
    );

    return {
        driveId: drive.id,
        driveTitle: drive.title,
        status: drive.status,
        isEligible: evaluation.isEligible,
        reasons: evaluation.reasons,
    };
};

module.exports = {
    evaluateStudentEligibility,
    getEligibleStudentsForDrive,
    checkStudentDriveEligibility,
};
