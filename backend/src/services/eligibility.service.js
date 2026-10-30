const prisma = require("../prismaClient");

// A threshold only applies when the drive actually sets one; a null threshold means "no restriction".
const hasLimit = value => value !== null && value !== undefined;
const belowMinimum = (actual, minimum) => hasLimit(minimum) && (actual == null || actual < minimum);

/** Recalculate eligibility from live academic, drive, and placement records. */
async function checkStudentEligibility(studentId, driveId, db = prisma) {
  const [student, drive] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true, departmentId: true, graduationYear: true,
        academicPathway: true, CGPA: true, tenthPercentage: true,
        twelfthPercentage: true, diplomaPercentage: true, activeBacklogs: true,
        // A selection record is official even if the student later declines the offer.
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

  if (!student) return { exists: false, driveExists: Boolean(drive), isEligible: false, reasons: ["STUDENT_NOT_FOUND"] };
  if (!drive) return { exists: true, driveExists: false, isEligible: false, reasons: ["DRIVE_NOT_FOUND"], student };

  const reasons = [];
  const criteria = drive.eligibilityCriteria;
  if (!criteria) {
    reasons.push("ELIGIBILITY_CRITERIA_NOT_CONFIGURED");
  } else {
    if (belowMinimum(student.CGPA, criteria.minimumCGPA)) reasons.push("MINIMUM_CGPA_NOT_MET");
    if (belowMinimum(student.tenthPercentage, criteria.minimumTenth)) reasons.push("MINIMUM_TENTH_PERCENTAGE_NOT_MET");
    if (student.academicPathway === "HSC" && belowMinimum(student.twelfthPercentage, criteria.minimumTwelfth)) reasons.push("MINIMUM_TWELFTH_PERCENTAGE_NOT_MET");
    if (student.academicPathway === "DIPLOMA" && belowMinimum(student.diplomaPercentage, criteria.minimumDiplomaPercentage)) reasons.push("MINIMUM_DIPLOMA_PERCENTAGE_NOT_MET");
    if (hasLimit(criteria.maximumBacklogs) && (student.activeBacklogs ?? 0) > criteria.maximumBacklogs) reasons.push("MAXIMUM_BACKLOGS_EXCEEDED");
    if (student.selection && !criteria.allowPreviousPlacement) reasons.push("PREVIOUS_PLACEMENT_NOT_ALLOWED");
  }

  if (!drive.company?.isActive) reasons.push("COMPANY_INACTIVE");
  if (drive.jobRole && drive.jobRole.companyId !== drive.companyId) reasons.push("JOB_ROLE_COMPANY_MISMATCH");
  if (drive.eligibleBranches.length && !drive.eligibleBranches.some(x => x.departmentId === student.departmentId)) reasons.push("DEPARTMENT_NOT_ELIGIBLE");
  if (drive.eligibleYears.length && !drive.eligibleYears.some(x => x.graduationYear === student.graduationYear)) reasons.push("GRADUATION_YEAR_NOT_ELIGIBLE");

  return { exists: true, driveExists: true, isEligible: reasons.length === 0, reasons, student, drive };
}

module.exports = { checkStudentEligibility };
/**
 * Evaluates whether a student meets the criteria for a placement drive.
 *
 * @param {Object} student - Student record including department, selection, etc.
 * @param {Object} criteria - EligibilityCriteria model instance
 * @param {Array<number>} eligibleBranchIds - Array of department IDs eligible for the drive
 * @param {Array<number>} eligibleYears - Array of graduation years eligible for the drive
 * @returns {{ isEligible: boolean, reasons: string[] }}
 */
const evaluateStudentEligibility = (
    student,
    criteria = {},
    eligibleBranchIds = [],
    eligibleYears = []
) => {
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
        if (minCGPA > 0) {
            if (student.CGPA === null || student.CGPA === undefined) {
                reasons.push("CGPA is not recorded.");
            } else if (Number(student.CGPA) < Number(minCGPA)) {
                reasons.push(
                    `CGPA (${student.CGPA}) is below the required minimum of ${minCGPA}.`
                );
            }
        }

        // 4. Minimum 10th Percentage Check
        const minTenth = criteria.minimumTenth ?? 0;
        if (minTenth > 0) {
            if (
                student.tenthPercentage === null ||
                student.tenthPercentage === undefined
            ) {
                reasons.push("10th percentage is not recorded.");
            } else if (Number(student.tenthPercentage) < Number(minTenth)) {
                reasons.push(
                    `10th percentage (${student.tenthPercentage}%) is below the required minimum of ${minTenth}%.`
                );
            }
        }

        // 5. Pathway Specific Check (12th / Diploma)
        if (student.academicPathway === "HSC") {
            const minTwelfth = criteria.minimumTwelfth;
            if (minTwelfth !== null && minTwelfth !== undefined && minTwelfth > 0) {
                if (
                    student.twelfthPercentage === null ||
                    student.twelfthPercentage === undefined
                ) {
                    reasons.push("12th percentage is not recorded.");
                } else if (Number(student.twelfthPercentage) < Number(minTwelfth)) {
                    reasons.push(
                        `12th percentage (${student.twelfthPercentage}%) is below the required minimum of ${minTwelfth}%.`
                    );
                }
            }
        } else if (student.academicPathway === "DIPLOMA") {
            const minDiploma = criteria.minimumDiplomaPercentage;
            if (minDiploma !== null && minDiploma !== undefined && minDiploma > 0) {
                if (
                    student.diplomaPercentage === null ||
                    student.diplomaPercentage === undefined
                ) {
                    reasons.push("Diploma percentage is not recorded.");
                } else if (Number(student.diplomaPercentage) < Number(minDiploma)) {
                    reasons.push(
                        `Diploma percentage (${student.diplomaPercentage}%) is below the required minimum of ${minDiploma}%.`
                    );
                }
            }
        }

        // 6. Active Backlogs Check
        const maxBacklogs = criteria.maximumBacklogs ?? 0;
        const currentBacklogs = student.activeBacklogs ?? 0;
        if (currentBacklogs > maxBacklogs) {
            reasons.push(
                `Active backlogs (${currentBacklogs}) exceed the maximum allowed (${maxBacklogs}).`
            );
        }

        // 7. Previous Placement / Single Offer Policy Check
        if (criteria.allowPreviousPlacement === false) {
            // Check if student already has an official selection
            const hasSelection = Boolean(
                student.selection ||
                (student.driveParticipations &&
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

    const drive = await prisma.placementDrive.findUnique({
        where: { id: Number(driveId) },
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
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const total = filteredList.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedList = filteredList.slice(startIndex, startIndex + limitNum);

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
 * Checks single student eligibility for a drive by student's user ID or student ID.
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
