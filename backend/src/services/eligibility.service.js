
const prisma = require("../prismaClient");

// A null or undefined threshold means no restriction.
const hasLimit = (value) => value !== null && value !== undefined;

const isValidNumber = (value, min, max) => {
    if (
        value === null ||
        value === undefined ||
        typeof value === "boolean"
    ) {
        return false;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= min && number <= max;
};

/**
 * Evaluates whether a student meets the criteria for a placement drive.
 * This function is shared by all eligibility endpoints to keep results consistent.
 */
const evaluateStudentEligibility = (
    student,
    criteria,
    eligibleBranchIds = [],
    eligibleYears = [],
    drive = null
) => {
    const reasons = [];

    // Missing criteria must never result in automatic eligibility.
    if (!criteria) {
        reasons.push("ELIGIBILITY_CRITERIA_NOT_CONFIGURED");

        return {
            isEligible: false,
            reasons,
        };
    }

    // 1. Company and job-role validation.
    if (drive) {
        if (drive.company && !drive.company.isActive) {
            reasons.push("COMPANY_INACTIVE");
        }

        if (
            drive.jobRole &&
            drive.jobRole.companyId !== drive.companyId
        ) {
            reasons.push("JOB_ROLE_COMPANY_MISMATCH");
        }
    }

    // 2. Department validation.
    if (
        eligibleBranchIds.length > 0 &&
        !eligibleBranchIds.includes(student.departmentId)
    ) {
        reasons.push("DEPARTMENT_NOT_ELIGIBLE");
    }

    // 3. Graduation year validation.
    if (
        eligibleYears.length > 0 &&
        !eligibleYears.includes(student.graduationYear)
    ) {
        reasons.push("GRADUATION_YEAR_NOT_ELIGIBLE");
    }

    // 4. CGPA validation.
    const minimumCGPA = Number(criteria.minimumCGPA ?? 0);

    if (!isValidNumber(student.CGPA, 0, 10)) {
        reasons.push("CGPA_MISSING_OR_INVALID");
    } else if (
        !Number.isFinite(minimumCGPA) ||
        minimumCGPA < 0 ||
        minimumCGPA > 10
    ) {
        reasons.push("INVALID_CGPA_CRITERIA");
    } else if (Number(student.CGPA) < minimumCGPA) {
        reasons.push("MINIMUM_CGPA_NOT_MET");
    }

    // 5. 10th percentage validation.
    const minimumTenth = Number(criteria.minimumTenth ?? 0);

    if (!isValidNumber(student.tenthPercentage, 0, 100)) {
        reasons.push("TENTH_PERCENTAGE_MISSING_OR_INVALID");
    } else if (
        !Number.isFinite(minimumTenth) ||
        minimumTenth < 0 ||
        minimumTenth > 100
    ) {
        reasons.push("INVALID_TENTH_CRITERIA");
    } else if (Number(student.tenthPercentage) < minimumTenth) {
        reasons.push("MINIMUM_TENTH_PERCENTAGE_NOT_MET");
    }

    // 6. Academic pathway validation.
    if (!["HSC", "DIPLOMA"].includes(student.academicPathway)) {
        reasons.push("ACADEMIC_PATHWAY_MISSING_OR_INVALID");
    }

    // 7. 12th percentage validation for HSC students.
    if (student.academicPathway === "HSC") {
        const minimum = criteria.minimumTwelfth;

        if (hasLimit(minimum) && Number(minimum) > 0) {
            if (!isValidNumber(student.twelfthPercentage, 0, 100)) {
                reasons.push("TWELFTH_PERCENTAGE_MISSING_OR_INVALID");
            } else if (
                !isValidNumber(minimum, 0, 100)
            ) {
                reasons.push("INVALID_TWELFTH_CRITERIA");
            } else if (Number(student.twelfthPercentage) < Number(minimum)) {
                reasons.push("MINIMUM_TWELFTH_PERCENTAGE_NOT_MET");
            }
        }
    }

    // 8. Diploma percentage validation for Diploma students.
    if (student.academicPathway === "DIPLOMA") {
        const minimum = criteria.minimumDiplomaPercentage;

        if (hasLimit(minimum) && Number(minimum) > 0) {
            if (!isValidNumber(student.diplomaPercentage, 0, 100)) {
                reasons.push("DIPLOMA_PERCENTAGE_MISSING_OR_INVALID");
            } else if (!isValidNumber(minimum, 0, 100)) {
                reasons.push("INVALID_DIPLOMA_CRITERIA");
            } else if (
                Number(student.diplomaPercentage) < Number(minimum)
            ) {
                reasons.push("MINIMUM_DIPLOMA_PERCENTAGE_NOT_MET");
            }
        }
    }

    // 9. Active backlogs validation.
    // If maximumBacklogs is null, there is no backlog restriction.
    if (hasLimit(criteria.maximumBacklogs)) {
        if (
            !Number.isInteger(student.activeBacklogs) ||
            student.activeBacklogs < 0
        ) {
            reasons.push("ACTIVE_BACKLOGS_MISSING_OR_INVALID");
        } else if (
            student.activeBacklogs > criteria.maximumBacklogs
        ) {
            reasons.push("MAXIMUM_BACKLOGS_EXCEEDED");
        }
    }

    // 10. Previous official placement validation.
    if (
        criteria.allowPreviousPlacement === false &&
        student.selection
    ) {
        reasons.push("PREVIOUS_PLACEMENT_NOT_ALLOWED");
    }

    return {
        isEligible: reasons.length === 0,
        reasons,
    };
};

/**
 * Recalculate eligibility using live academic, drive and placement records.
 */
async function checkStudentEligibility(studentId, driveId, db = prisma) {
    const [student, drive] = await Promise.all([
        db.student.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                departmentId: true,
                graduationYear: true,
                academicPathway: true,
                CGPA: true,
                tenthPercentage: true,
                twelfthPercentage: true,
                diplomaPercentage: true,
                activeBacklogs: true,
                selection: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        }),

        db.placementDrive.findUnique({
            where: { id: driveId },
            include: {
                eligibilityCriteria: true,
                eligibleBranches: {
                    select: { departmentId: true },
                },
                eligibleYears: {
                    select: { graduationYear: true },
                },
                company: {
                    select: { isActive: true },
                },
                jobRole: {
                    select: { companyId: true },
                },
            },
        }),
    ]);

    if (!student) {
        return {
            exists: false,
            driveExists: Boolean(drive),
            isEligible: false,
            reasons: ["STUDENT_NOT_FOUND"],
        };
    }

    if (!drive) {
        return {
            exists: true,
            driveExists: false,
            isEligible: false,
            reasons: ["DRIVE_NOT_FOUND"],
            student,
        };
    }

    const eligibleBranchIds = drive.eligibleBranches.map(
        (branch) => branch.departmentId
    );

    const eligibleYears = drive.eligibleYears.map(
        (year) => year.graduationYear
    );

    const evaluation = evaluateStudentEligibility(
        student,
        drive.eligibilityCriteria,
        eligibleBranchIds,
        eligibleYears,
        drive
    );

    return {
        exists: true,
        driveExists: true,
        isEligible: evaluation.isEligible,
        reasons: evaluation.reasons,
        student,
        drive,
    };
}

/**
 * Calculates eligible students for a specific placement drive.
 * Supports filtering, searching and pagination.
 */
const getEligibleStudentsForDrive = async (driveId, options = {}) => {
    const {
        page = 1,
        limit = 50,
        search = "",
        departmentId,
        graduationYear,
        statusFilter = "eligible_only",
    } = options;

    // Validate status filter.
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

    // Validate drive ID.
    const driveIdNum = Number(driveId);

    if (!Number.isInteger(driveIdNum) || driveIdNum <= 0) {
        const error = new Error("Invalid driveId.");
        error.statusCode = 400;
        throw error;
    }

    // Validate pagination.
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (
        !Number.isInteger(pageNum) ||
        pageNum < 1 ||
        !Number.isInteger(limitNum) ||
        limitNum < 1
    ) {
        const error = new Error("Invalid pagination parameters.");
        error.statusCode = 400;
        throw error;
    }

    const safeLimit = Math.min(limitNum, 100);

    // Validate optional filters.
    const where = {};

    if (departmentId !== undefined) {
        const id = Number(departmentId);

        if (!Number.isInteger(id) || id <= 0) {
            const error = new Error("Invalid departmentId.");
            error.statusCode = 400;
            throw error;
        }

        where.departmentId = id;
    }

    if (graduationYear !== undefined) {
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

    if (search.trim() !== "") {
        const searchTerm = search.trim();

        where.OR = [
            {
                PRN: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            },
            {
                user: {
                    name: {
                        contains: searchTerm,
                        mode: "insensitive",
                    },
                },
            },
            {
                user: {
                    email: {
                        contains: searchTerm,
                        mode: "insensitive",
                    },
                },
            },
        ];
    }

    // Fetch drive details and eligibility configuration.
    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        include: {
            company: {
                select: {
                    id: true,
                    name: true,
                    isActive: true,
                },
            },
            jobRole: {
                select: {
                    id: true,
                    title: true,
                    companyId: true,
                },
            },
            eligibilityCriteria: true,
            eligibleBranches: {
                include: {
                    department: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                },
            },
            eligibleYears: true,
        },
    });

    if (!drive) {
        return null;
    }

    const eligibleBranchIds = drive.eligibleBranches.map(
        (branch) => branch.departmentId
    );

    const eligibleYears = drive.eligibleYears.map(
        (year) => year.graduationYear
    );

    const criteria = drive.eligibilityCriteria;

    // Fetch candidate records.
    const candidates = await prisma.student.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            department: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
            selection: {
                select: {
                    id: true,
                    driveId: true,
                    status: true,
                    packageLPA: true,
                },
            },
        },
        orderBy: [
            { CGPA: "desc" },
            { PRN: "asc" },
        ],
    });

    // Evaluate every candidate using the shared evaluator.
    const evaluated = candidates.map((student) => {
        const evaluation = evaluateStudentEligibility(
            student,
            criteria,
            eligibleBranchIds,
            eligibleYears,
            drive
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

    const eligibleCount = evaluated.filter(
        (student) => student.isEligible
    ).length;

    const ineligibleCount = evaluated.length - eligibleCount;

    // Apply eligibility status filter.
    let filteredList = evaluated;

    if (statusFilter === "eligible_only") {
        filteredList = evaluated.filter(
            (student) => student.isEligible
        );
    } else if (statusFilter === "ineligible_only") {
        filteredList = evaluated.filter(
            (student) => !student.isEligible
        );
    }

    // Apply pagination.
    const total = filteredList.length;
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIndex = (pageNum - 1) * safeLimit;

    const paginatedList = filteredList.slice(
        startIndex,
        startIndex + safeLimit
    );

    return {
        drive: {
            id: drive.id,
            title: drive.title,
            companyName: drive.company?.name || "",
            jobRoleTitle: drive.jobRole?.title || "",
            status: drive.status,
            packageLPA: drive.packageLPA,
        },

        criteria: {
            minimumCGPA: criteria?.minimumCGPA ?? 0,
            minimumTenth: criteria?.minimumTenth ?? 0,
            minimumTwelfth: criteria?.minimumTwelfth ?? null,
            minimumDiplomaPercentage:
                criteria?.minimumDiplomaPercentage ?? null,
            maximumBacklogs: criteria?.maximumBacklogs ?? null,
            allowPreviousPlacement:
                criteria?.allowPreviousPlacement ?? false,

            eligibleDepartments: drive.eligibleBranches.map((branch) => ({
                id: branch.department.id,
                name: branch.department.name,
                code: branch.department.code,
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
            limit: safeLimit,
            total,
            totalPages,
        },

        data: paginatedList,
    };
};

/**
 * Checks eligibility for a student using Student ID and Drive ID.
 */
const checkStudentDriveEligibility = async (studentId, driveId) => {
    const studentIdNum = Number(studentId);
    const driveIdNum = Number(driveId);

    if (
        !Number.isInteger(studentIdNum) ||
        studentIdNum <= 0 ||
        !Number.isInteger(driveIdNum) ||
        driveIdNum <= 0
    ) {
        return {
            error: true,
            message: "Invalid student ID or drive ID.",
        };
    }

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        include: {
            eligibilityCriteria: true,
            eligibleBranches: true,
            eligibleYears: true,
            company: {
                select: {
                    isActive: true,
                },
            },
            jobRole: {
                select: {
                    companyId: true,
                },
            },
        },
    });

    if (!drive) {
        return {
            notFound: true,
            message: "Placement drive not found.",
        };
    }

    const student = await prisma.student.findUnique({
        where: { id: studentIdNum },
        include: {
            department: true,
            selection: true,
        },
    });

    if (!student) {
        return {
            notFound: true,
            message: "Student record not found.",
        };
    }

    const eligibleBranchIds = drive.eligibleBranches.map(
        (branch) => branch.departmentId
    );

    const eligibleYears = drive.eligibleYears.map(
        (year) => year.graduationYear
    );

    const evaluation = evaluateStudentEligibility(
        student,
        drive.eligibilityCriteria,
        eligibleBranchIds,
        eligibleYears,
        drive
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
    checkStudentEligibility,
    evaluateStudentEligibility,
    getEligibleStudentsForDrive,
    checkStudentDriveEligibility,
};
