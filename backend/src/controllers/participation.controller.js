const prisma = require("../prismaClient");
const { checkStudentEligibility } = require("../services/eligibility.service");

// Accept only real positive integers (number, or a string of digits). Number() alone lets [5], true, "1e1" and " 7 " through.
const validId = value => (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const PARTICIPATION_STATUSES = ["APPLIED", "SHORTLISTED", "INTERVIEW_SCHEDULED", "REJECTED"];
const transitions = {
  APPLIED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW_SCHEDULED", "REJECTED"],
  INTERVIEW_SCHEDULED: ["REJECTED"],
  REJECTED: [],
};
const error = (res, status, code, message, details) => res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) }, message });

async function listDriveParticipations(req, res) {
  try {
    const driveId = Number(req.params.driveId);
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!validId(req.params.driveId) || !Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)
      return error(res, 400, "VALIDATION_ERROR", "driveId, page, or limit is invalid.");
    const processStatus = req.query.processStatus;
    if (processStatus && !PARTICIPATION_STATUSES.includes(processStatus)) return error(res, 400, "VALIDATION_ERROR", "Invalid processStatus.", [{ field: "processStatus", message: "Use a valid participation status." }]);
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId }, select: { id: true } });
    if (!drive) return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    const where = { driveId, ...(processStatus ? { processStatus } : {}) };
    const [rows, total] = await Promise.all([
      prisma.driveParticipation.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: { student: { select: { id: true, PRN: true, graduationYear: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } } } },
      }), prisma.driveParticipation.count({ where }),
    ]);
    const data = rows.map(p => ({ participationId: p.id, studentId: p.studentId, PRN: p.student.PRN, studentName: p.student.user.name, department: p.student.department, graduationYear: p.student.graduationYear, processStatus: p.processStatus, createdAt: p.createdAt, updatedAt: p.updatedAt }));
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { console.error("listDriveParticipations:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch participations."); }
}

async function addDriveParticipations(req, res) {
  try {
    const driveId = Number(req.params.driveId);
    const { studentIds } = req.body || {};
    if (!validId(req.params.driveId) || !Array.isArray(studentIds) || !studentIds.length || studentIds.length > 500 || studentIds.some(id => !validId(id)))
      return error(res, 400, "VALIDATION_ERROR", "Provide a driveId and a non-empty studentIds array of positive integers (maximum 500).", [{ field: "studentIds", message: "Expected positive student IDs." }]);
    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId }, select: { id: true, status: true, applicationDeadline: true } });
    if (!drive) return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    if (["CANCELLED", "COMPLETED"].includes(drive.status)) return error(res, 422, "DRIVE_CLOSED", "Cannot add students to a cancelled or completed drive.");
    if (drive.applicationDeadline && new Date() > drive.applicationDeadline) return error(res, 422, "APPLICATION_DEADLINE_PASSED", "The application deadline has passed.");

    const uniqueIds = [...new Set(studentIds.map(Number))];
    const students = await prisma.student.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
    const existingIds = new Set(students.map(s => s.id));
    const missingIds = uniqueIds.filter(id => !existingIds.has(id));
    if (missingIds.length) return error(res, 404, "STUDENT_NOT_FOUND", "One or more students were not found.", missingIds.map(id => ({ field: "studentIds", message: `Student ${id} was not found.` })));

    const created = [], skipped = [];
    for (const studentId of uniqueIds) {
      const eligibility = await checkStudentEligibility(studentId, driveId);
      if (!eligibility.isEligible) { skipped.push({ studentId, reason: "NOT_ELIGIBLE", details: eligibility.reasons }); continue; }
      const existing = await prisma.driveParticipation.findUnique({ where: { studentId_driveId: { studentId, driveId } }, select: { id: true, processStatus: true } });
      if (existing) { skipped.push({ studentId, reason: "ALREADY_PARTICIPATING", participationId: existing.id, processStatus: existing.processStatus }); continue; }
      try {
        const participation = await prisma.$transaction(async tx => {
          const row = await tx.driveParticipation.create({ data: { studentId, driveId, processStatus: "APPLIED" } });
          await tx.placementStatusHistory.create({ data: { participationId: row.id, oldStatus: null, newStatus: "APPLIED", changedByUserId: req.user.id, remarks: "Added to drive by TPO." } });
          return row;
        });
        created.push({ studentId, participationId: participation.id, processStatus: participation.processStatus });
      } catch (e) {
        if (e.code === "P2002") {
          const current = await prisma.driveParticipation.findUnique({ where: { studentId_driveId: { studentId, driveId } }, select: { id: true, processStatus: true } });
          skipped.push({ studentId, reason: "ALREADY_PARTICIPATING", participationId: current?.id, processStatus: current?.processStatus });
        } else throw e;
      }
    }
    return res.status(created.length ? 201 : 200).json({ success: true, data: { created, skipped } });
  } catch (e) { console.error("addDriveParticipations:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to add participations."); }
}

async function getParticipation(req, res) {
  try {
    const id = Number(req.params.participationId);
    if (!validId(req.params.participationId)) return error(res, 400, "VALIDATION_ERROR", "Invalid participationId.");
    const p = await prisma.driveParticipation.findUnique({ where: { id }, include: {
      student: { select: { id: true, PRN: true, graduationYear: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } } },
      drive: { select: { id: true, title: true, status: true, applicationDeadline: true, packageLPA: true, company: { select: { id: true, name: true } }, jobRole: { select: { id: true, title: true, companyId: true } } } },
    } });
    if (!p) return error(res, 404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
    return res.json({ success: true, data: { participationId: p.id, student: p.student, drive: p.drive, processStatus: p.processStatus, createdAt: p.createdAt, updatedAt: p.updatedAt } });
  } catch (e) { console.error("getParticipation:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch participation."); }
}

async function updateParticipationStatus(req, res) {
  try {
    const id = Number(req.params.participationId);
    const newStatus = req.body?.newStatus ?? req.body?.status;
    const remarks = req.body?.remarks;
    if (!validId(req.params.participationId) || !PARTICIPATION_STATUSES.includes(newStatus)) return error(res, 400, "VALIDATION_ERROR", "A valid participationId and newStatus are required.", [{ field: "newStatus", message: `Allowed values: ${PARTICIPATION_STATUSES.join(", ")}.` }]);
    if (remarks != null && typeof remarks !== "string") return error(res, 400, "VALIDATION_ERROR", "remarks must be a string or null.");
    const result = await prisma.$transaction(async tx => {
      const current = await tx.driveParticipation.findUnique({ where: { id } });
      if (!current) return { notFound: true };
      if (current.processStatus === newStatus) return { data: current };
      if (!transitions[current.processStatus]?.includes(newStatus)) return { invalidTransition: true, currentStatus: current.processStatus };

      // Compare-and-set: the UPDATE only succeeds if the row is still in the status we validated against.
      // Without this, two TPOs acting at once both pass the transition check and the history shows two
      // transitions out of the same old status.
      const swapped = await tx.driveParticipation.updateMany({ where: { id, processStatus: current.processStatus }, data: { processStatus: newStatus } });
      if (swapped.count === 0) return { conflict: true };

      // A student who is officially selected through this drive cannot be rejected from it.
      // Checked after the row is locked by the update above, so it cannot race with createSelection.
      if (newStatus === "REJECTED") {
        const selection = await tx.studentSelection.findUnique({ where: { studentId: current.studentId }, select: { driveId: true } });
        if (selection && selection.driveId === current.driveId) throw Object.assign(new Error("SELECTION_EXISTS"), { code: "SELECTION_EXISTS" });
      }

      await tx.placementStatusHistory.create({ data: { participationId: id, oldStatus: current.processStatus, newStatus, remarks: remarks?.trim() || null, changedByUserId: req.user.id } });
      return { data: await tx.driveParticipation.findUnique({ where: { id } }) };
    });
    if (result.notFound) return error(res, 404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
    if (result.invalidTransition) return error(res, 422, "INVALID_STATUS_TRANSITION", `Cannot change participation from ${result.currentStatus} to ${newStatus}.`);
    if (result.conflict) return error(res, 409, "CONCURRENT_UPDATE", "The participation status was changed by someone else. Reload and try again.");
    return res.json({ success: true, data: result.data });
  } catch (e) {
    if (e.code === "SELECTION_EXISTS") return error(res, 422, "SELECTION_EXISTS", "This student is already officially selected through this drive and cannot be rejected.");
    console.error("updateParticipationStatus:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to update participation status.");
  }
}

async function getParticipationHistory(req, res) {
  try {
    const id = Number(req.params.participationId);
    if (!validId(req.params.participationId)) return error(res, 400, "VALIDATION_ERROR", "Invalid participationId.");
    const participation = await prisma.driveParticipation.findUnique({ where: { id }, select: { id: true } });
    if (!participation) return error(res, 404, "PARTICIPATION_NOT_FOUND", "Participation not found.");
    const data = await prisma.placementStatusHistory.findMany({ where: { participationId: id }, orderBy: [{ changedAt: "asc" }, { id: "asc" }], include: { changedBy: { select: { id: true, name: true, role: true } } } });
    return res.json({ success: true, data });
  } catch (e) { console.error("getParticipationHistory:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch participation history."); }
}

module.exports = { listDriveParticipations, addDriveParticipations, getParticipation, updateParticipationStatus, getParticipationHistory };
