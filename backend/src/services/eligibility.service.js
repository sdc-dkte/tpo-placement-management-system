
const prisma = require("../prismaClient");

// A null threshold means no restriction.
const hasLimit = (value) => value !== null && value !== undefined;

const belowMinimum = (actual, minimum) =>
    hasLimit(minimum) && (actual == null || Number(actual) < Number(minimum));

/** Recalculate eligibility from live academic, drive, and placement records. */
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
                selection: { select: { id: true, status: true } },
            },
        }),
        db.placementDrive.findUnique({
            where: { id: driveId },
            include: {
                eligibilityCriteria: true,
                eligibleBranches: { select: { departmentId: true } },
                eligibleYears: { select: { graduationYear: true } },
                company: { select: { isActive: true } },
                jobRole: { select: { companyId: true } },
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

    const reasons = [];
    const criteria = drive.eligibilityCriteria;

    if (!criteria) {
        reasons.push("ELIGIBILITY_CRITERIA_NOT_CONFIGURED");
    } else {
        if (belowMinimum(student.CGPA, criteria.minimumCGPA)) {
            reasons.push("MINIMUM_CGPA_NOT_MET");
        }

        if (belowMinimum(student.tenthPercentage, criteria.minimumTenth)) {
            reasons.push("MINIMUM_TENTH_PERCENTAGE_NOT_MET");
        }

        if (
            student.academicPathway === "HSC" &&
            belowMinimum(student.twelfthPercentage, criteria.minimumTwelfth)
        ) {
            reasons.push("MINIMUM_TWELFTH_PERCENTAGE_NOT_MET");
        }

        if (
            student.academicPathway === "DIPLOMA" &&
            belowMinimum(
                student.diplomaPercentage,
                criteria.minimumDiplomaPercentage
            )
        ) {
            reasons.push("MINIMUM_DIPLOMA_PERCENTAGE_NOT_MET");
        }

        if (
            hasLimit(criteria.maximumBacklogs) &&
            (student.activeBacklogs ?? 0) > criteria.maximumBacklogs
        ) {
            reasons.push("MAXIMUM_BACKLOGS_EXCEEDED");
        }

        if (student.selection && !criteria.allowPreviousPlacement) {
            reasons.push("PREVIOUS_PLACEMENT_NOT_ALLOWED");
        }
    }

    if (!drive.company?.isActive) {
        reasons.push("COMPANY_INACTIVE");
    }

    if (drive.jobRole && drive.jobRole.companyId !== drive.companyId) {
        reasons.push("JOB_ROLE_COMPANY_MISMATCH");
    }

    if (
        drive.eligibleBranches.length &&
        !drive.eligibleBranches.some(
            (branch) => branch.departmentId === student.departmentId
        )
    ) {
        reasons.push("DEPARTMENT_NOT_ELIGIBLE");
    }

    if (
        drive.eligibleYears.length &&
        !drive.eligibleYears.some(
            (year) => year.graduationYear === student.graduationYear
        )
    ) {
        reasons.push("GRADUATION_YEAR_NOT_ELIGIBLE");
    }

    return {
        exists: true,
        driveExists: true,
        isEligible: reasons.length === 0,
        reasons,
        student,
        drive,
    };
}

/**
 * Evaluates whether a student meets the criteria for a placement drive.
 */
const evaluateStudentEligibility = (
    student,
    criteria,
    eligibleBranchIds = [],
    eligibleYears = []
) => {
    const reasons = [];

    // Missing criteria must never result in automatic eligibility.
    if (!criteria) {
        return {
            isEligible: false,
            reasons: ["ELIGIBILITY_CRITERIA_NOT_CONFIGURED"],
        };
    }

    // 1. Department / Branch Check
    if (
        eligibleBranchIds.length > 0 &&
        !eligibleBranchIds.includes(student.departmentId)
    ) {
        reasons.push("DEPARTMENT_NOT_ELIGIBLE");
    }

    // 2. Graduation Year Check
    if (
        eligibleYears.length > 0 &&
        !eligibleYears.includes(student.graduationYear)
    ) {
        reasons.push("GRADUATION_YEAR_NOT_ELIGIBLE");
    }

    // 3. Minimum CGPA Check
    if (belowMinimum(student.CGPA, criteria.minimumCGPA)) {
        reasons.push("MINIMUM_CGPA_NOT_MET");
    }

    // 4. Minimum 10th Percentage Check
    if (belowMinimum(student.tenthPercentage, criteria.minimumTenth)) {
        reasons.push("MINIMUM_TENTH_PERCENTAGE_NOT_MET");
    }

    // 5. Pathway-specific academic checks
    if (
        student.academicPathway === "HSC" &&
        belowMinimum(student.twelfthPercentage, criteria.minimumTwelfth)
    ) {
        reasons.push("MINIMUM_TWELFTH_PERCENTAGE_NOT_MET");
    }

    if (
        student.academicPathway === "DIPLOMA" &&
        belowMinimum(
            student.diplomaPercentage,
            criteria.minimumDiplomaPercentage
        )
    ) {
        reasons.push("MINIMUM_DIPLOMA_PERCENTAGE_NOT_MET");
    }

    // 6. Active Backlogs Check
    // Null maximumBacklogs means no restriction.
    if (
        hasLimit(criteria.maximumBacklogs) &&
        (student.activeBacklogs ?? 0) > criteria.maximumBacklogs
    ) {
        reasons.push("MAXIMUM_BACKLOGS_EXCEEDED");
    }

    // 7. Previous Official Placement Check
    if (criteria.allowPreviousPlacement === false && student.selection) {
        reasons.push("PREVIOUS_PLACEMENT_NOT_ALLOWED");
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
        statusFilter = "eligible_only",
    } = options;

    const drive = await prisma.placementDrive.findUnique({
        where: { id: Number(driveId) },
        include: {
            company: { select: { id: true, name: true, isActive: true } },
            jobRole: { select: { id: true, title: true, companyId: true } },
            eligibilityCriteria: true,
            eligibleBranches: {
                include: {
                    department: {
                        select: { id: true, name: true, code: true },
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

    // Build Prisma where clause.
    const where = {};

    if (departmentId) {
        where.departmentId = Number(departmentId);
    }

    if (graduationYear) {
        where.graduationYear = Number(graduationYear);
    }

    if (search && search.trim() !== "") {
        const searchTerm = search.trim();

        where.OR = [
            { PRN: { contains: searchTerm, mode: "insensitive" } },
            { user: { name: { contains: searchTerm, mode: "insensitive" } } },
            { user: { email: { contains: searchTerm, mode: "insensitive" } } },
        ];
    }

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

    const eligibleCount = evaluated.filter(
        (student) => student.isEligible
    ).length;

    const ineligibleCount = evaluated.length - eligibleCount;

    let filteredList = evaluated;

    if (statusFilter === "eligible_only") {
        filteredList = evaluated.filter((student) => student.isEligible);
    } else if (statusFilter === "ineligible_only") {
        filteredList = evaluated.filter((student) => !student.isEligible);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    const total = filteredList.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
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
            minimumDiplomaPercentage:
                criteria?.minimumDiplomaPercentage ?? null,
            maximumBacklogs: criteria?.maximumBacklogs ?? null,
            allowPreviousPlacement: criteria?.allowPreviousPlacement ?? false,
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
            limit: limitNum,
            total,
            totalPages,
        },
        data: paginatedList,
    };
};

/**
 * Checks single student eligibility for a drive.
 */
const checkStudentDriveEligibility = async (studentId, driveId) => {
    const drive = await prisma.placementDrive.findUnique({
        where: { id: Number(driveId) },
        include: {
            eligibilityCriteria: true,
            eligibleBranches: true,
            eligibleYears: true,
        },
    });

    if (!drive) {
        return {
            notFound: true,
            message: "Placement drive not found.",
        };
    }

    const student = await prisma.student.findUnique({
        where: { id: Number(studentId) },
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
    checkStudentEligibility,
    evaluateStudentEligibility,
    getEligibleStudentsForDrive,
    checkStudentDriveEligibility,
};
