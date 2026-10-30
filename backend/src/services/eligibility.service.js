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
