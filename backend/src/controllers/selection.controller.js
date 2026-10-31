const prisma = require("../prismaClient");
const { checkStudentEligibility } = require("../services/eligibility.service");
// Accept only real positive integers (number, or a string of digits). Number() alone lets [5], true, "1e1" and " 7 " through.
const validId = value => (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
// packageLPA must be a JSON number or a plain decimal string such as "12.5". Returns the number, or null when invalid.
// Booleans, null, arrays, objects, "", "abc", "1e3", NaN and Infinity are rejected instead of being coerced by Number().
// The project defines no maximum LPA, so the only rule is "finite and greater than zero".
const parsePackageLPA = value => {
  const text = typeof value === "string" ? value.trim() : "";
  const parsed = typeof value === "number" ? value : /^\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const error = (res, status, code, message, details) => res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) }, message });
const statuses = ["SELECTED", "OFFER_ACCEPTED", "OFFER_DECLINED"];

async function createSelection(req, res) {
  const studentId = validId(req.body?.studentId) ? Number(req.body.studentId) : NaN;
  const driveId = validId(req.body?.driveId) ? Number(req.body.driveId) : NaN;
  const status = req.body?.status ?? "SELECTED";
  // Missing packageLPA falls back to the drive's package; an explicit null is invalid, not "missing".
  const requestedPackage = req.body?.packageLPA === undefined ? undefined : parsePackageLPA(req.body.packageLPA);
  if (!validId(studentId) || !validId(driveId)) return error(res, 400, "VALIDATION_ERROR", "studentId and driveId must be positive integers.");
  if (status !== "SELECTED") return error(res, 422, "INVALID_SELECTION_STATUS", "A new official selection must start with SELECTED.");
  if (requestedPackage === null) return error(res, 400, "VALIDATION_ERROR", "packageLPA must be a positive number.", [{ field: "packageLPA", message: "Send a number greater than 0, for example 12.5." }]);

  try {
    const [student, drive, participation, existing] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
      prisma.placementDrive.findUnique({ where: { id: driveId }, include: { company: { select: { id: true, name: true, isActive: true } }, jobRole: { select: { id: true, title: true, companyId: true } } } }),
      prisma.driveParticipation.findUnique({ where: { studentId_driveId: { studentId, driveId } } }),
      prisma.studentSelection.findUnique({ where: { studentId }, select: { id: true, status: true, driveId: true } }),
    ]);
    if (!student) return error(res, 404, "STUDENT_NOT_FOUND", "Student not found.");
    if (!drive) return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    if (existing) return error(res, 409, "OFFICIAL_SELECTION_EXISTS", "Student already has an official placement record.", [{ field: "studentId", message: `Existing selectionId: ${existing.id}.` }]);
    if (!participation) return error(res, 422, "PARTICIPATION_REQUIRED", "Student must have a participation record for this drive before selection.");
    if (!["SHORTLISTED", "INTERVIEW_SCHEDULED"].includes(participation.processStatus)) return error(res, 422, "PARTICIPATION_STAGE_REQUIRED", "Only shortlisted or interview-scheduled participants can be selected.");
    if (["CANCELLED", "COMPLETED"].includes(drive.status)) return error(res, 422, "DRIVE_CLOSED", "Cannot create a selection for a cancelled or completed drive.");
    if (!drive.company?.isActive) return error(res, 422, "COMPANY_INACTIVE", "The drive's company is inactive.");
    if (!drive.jobRole || drive.jobRole.companyId !== drive.companyId) return error(res, 422, "JOB_ROLE_COMPANY_MISMATCH", "The drive job role must belong to the same company as the drive.");

    const eligibility = await checkStudentEligibility(studentId, driveId);
    if (!eligibility.isEligible) return error(res, 422, "NOT_ELIGIBLE", "Student does not currently meet this drive's eligibility criteria.", eligibility.reasons.map(reason => ({ field: "eligibility", message: reason })));

    const packageLPA = requestedPackage === undefined ? drive.packageLPA : requestedPackage;
    // Dashboards and reports average packageLPA, so an official selection must always carry one.
    if (packageLPA == null) return error(res, 422, "PACKAGE_REQUIRED", "This drive has no package set. Provide packageLPA to record the selection.");
    const data = await prisma.$transaction(async tx => {
      // Recheck inside the transaction; the unique studentId constraint is the final concurrency guard.
      const selection = await tx.studentSelection.findUnique({ where: { studentId }, select: { id: true } });
      if (selection) { const conflict = new Error("OFFICIAL_SELECTION_EXISTS"); conflict.code = "OFFICIAL_SELECTION_EXISTS"; throw conflict; }
      const currentParticipation = await tx.driveParticipation.findUnique({ where: { studentId_driveId: { studentId, driveId } } });
      if (!currentParticipation || !["SHORTLISTED", "INTERVIEW_SCHEDULED"].includes(currentParticipation.processStatus)) {
        const invalid = new Error("PARTICIPATION_STAGE_REQUIRED"); invalid.code = "PARTICIPATION_STAGE_REQUIRED"; throw invalid;
      }
      // Compare-and-set on the participation row. The WHERE matches the id AND the exact status read above, and the
      // data never writes that status back, so a newer status set by another TPO can never be overwritten.
      // PostgreSQL takes a row lock for the UPDATE: a concurrent status change waits for this transaction, and if it
      // committed first the WHERE no longer matches (0 rows). The selection is created only after this succeeds.
      const lockedParticipation = await tx.driveParticipation.updateMany({
        where: { id: currentParticipation.id, processStatus: currentParticipation.processStatus },
        data: { updatedAt: new Date() },
      });
      if (lockedParticipation.count !== 1) { const changed = new Error("PARTICIPATION_STATUS_CHANGED"); changed.code = "PARTICIPATION_STATUS_CHANGED"; throw changed; }
      return tx.studentSelection.create({
        data: { studentId, driveId, status: "SELECTED", packageLPA },
        include: { student: { select: { id: true, PRN: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } } }, drive: { include: { company: { select: { id: true, name: true } }, jobRole: { select: { id: true, title: true } } } } },
      });
    });
    return res.status(201).json({ success: true, data });
  } catch (e) {
    if (e.code === "P2002" || e.code === "OFFICIAL_SELECTION_EXISTS") return error(res, 409, "OFFICIAL_SELECTION_EXISTS", "Student already has an official placement record.");
    if (e.code === "PARTICIPATION_STATUS_CHANGED") return error(res, 409, "CONCURRENT_UPDATE", "The participation status was changed by someone else. Reload and try again.");
    if (e.code === "PARTICIPATION_STAGE_REQUIRED") return error(res, 422, "PARTICIPATION_STAGE_REQUIRED", "Student must be shortlisted or interview-scheduled before selection.");
    if (e.code === "P2003" || e.code === "P2025") return error(res, 404, "RELATED_RECORD_NOT_FOUND", "Student or drive was not found.");
    console.error("createSelection:", e);
    return error(res, 500, "INTERNAL_ERROR", "Failed to record selection.");
  }
}

async function getSelection(req, res) {
  try {
    const id = Number(req.params.selectionId);
    if (!validId(req.params.selectionId)) return error(res, 400, "VALIDATION_ERROR", "Invalid selectionId.");
    const data = await prisma.studentSelection.findUnique({ where: { id }, include: {
      student: { select: { id: true, PRN: true, graduationYear: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } } },
      drive: { include: { company: { select: { id: true, name: true } }, jobRole: { select: { id: true, title: true, companyId: true } } } },
    } });
    if (!data) return error(res, 404, "SELECTION_NOT_FOUND", "Selection not found.");
    return res.json({ success: true, data });
  } catch (e) { console.error("getSelection:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch selection."); }
}

async function updateSelectionStatus(req, res) {
  try {
    const id = Number(req.params.selectionId);
    const status = req.body?.status;
    if (!validId(req.params.selectionId) || !statuses.includes(status)) return error(res, 400, "VALIDATION_ERROR", "A valid selectionId and status are required.", [{ field: "status", message: `Allowed values: ${statuses.join(", ")}.` }]);
    const allowedNext = { SELECTED: ["OFFER_ACCEPTED", "OFFER_DECLINED"], OFFER_ACCEPTED: [], OFFER_DECLINED: [] };
    const result = await prisma.$transaction(async tx => {
      const current = await tx.studentSelection.findUnique({ where: { id } });
      if (!current) return { notFound: true };
      if (current.status === status) return { data: current };
      if (!allowedNext[current.status]?.includes(status)) return { invalidTransition: true, currentStatus: current.status };
      // Compare-and-set so accept/decline racing each other cannot both succeed.
      const swapped = await tx.studentSelection.updateMany({ where: { id, status: current.status }, data: { status } });
      if (swapped.count === 0) return { conflict: true };
      return { data: await tx.studentSelection.findUnique({ where: { id } }) };
    });
    if (result.notFound) return error(res, 404, "SELECTION_NOT_FOUND", "Selection not found.");
    if (result.invalidTransition) return error(res, 422, "INVALID_STATUS_TRANSITION", `Cannot change selection status from ${result.currentStatus} to ${status}.`);
    if (result.conflict) return error(res, 409, "CONCURRENT_UPDATE", "The offer status was changed by someone else. Reload and try again.");
    return res.json({ success: true, data: result.data });
  } catch (e) { console.error("updateSelectionStatus:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to update offer status."); }
}

module.exports = { createSelection, getSelection, updateSelectionStatus };