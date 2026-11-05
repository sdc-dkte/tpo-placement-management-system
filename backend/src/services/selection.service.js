
const { evaluateStudentEligibility } = require("./eligibility.service");

const failWith = (code, extra = {}) =>
    Object.assign(new Error(code), { code, ...extra });

async function createOfficialSelection(tx, { studentId, driveId, packageLPA }) {
    // 1. Check whether the student already has an official selection.
    const duplicate = await tx.studentSelection.findUnique({
        where: { studentId },
        select: { id: true },
    });

    if (duplicate) {
        throw failWith("OFFICIAL_SELECTION_EXISTS");
    }

    // 2. Fetch current student information.
    const student = await tx.student.findUnique({
        where: { id: studentId },
        include: {
            selection: true,
            user: { select: { isActive: true } },
        },
    });

    if (!student) {
        throw failWith("P2025");
    }

    if (!student.user?.isActive) {
        throw failWith("STUDENT_INACTIVE");
    }

    // 3. Fetch drive and its related records.
    const drive = await tx.placementDrive.findUnique({
        where: { id: driveId },
        include: {
            company: { select: { id: true, isActive: true } },
            jobRole: { select: { id: true, companyId: true } },
            eligibilityCriteria: true,
            eligibleBranches: true,
            eligibleYears: true,
        },
    });

    if (!drive) {
        throw failWith("P2025");
    }

    // 4. Validate drive-level conditions.
    if (drive.status === "CANCELLED") {
        throw failWith("DRIVE_CLOSED");
    }

    if (!drive.company?.isActive) {
        throw failWith("COMPANY_INACTIVE");
    }

    if (!drive.jobRole || drive.jobRole.companyId !== drive.companyId) {
        throw failWith("JOB_ROLE_COMPANY_MISMATCH");
    }

    // 5. Recalculate eligibility using current transaction data.
    const eligibility = evaluateStudentEligibility(
        student,
        drive.eligibilityCriteria,
        drive.eligibleBranches.map(branch => branch.departmentId),
        drive.eligibleYears.map(year => year.graduationYear)
    );

    if (!eligibility.isEligible) {
        throw failWith("NOT_ELIGIBLE", {
            reasons: eligibility.reasons,
        });
    }

    // 6. Create official selection.
    return tx.studentSelection.create({
        data: {
            studentId,
            driveId,
            status: "SELECTED",
            packageLPA,
        },
    });
}

module.exports = { createOfficialSelection };
