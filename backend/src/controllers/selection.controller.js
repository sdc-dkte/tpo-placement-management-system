const prisma = require("../prismaClient");
const { evaluateStudentEligibility } = require("../services/eligibility.service");

// V1 is a direct-selection workflow: the TPO verifies the outcome outside the portal and records it here.
// Nothing in this file reads or writes DriveParticipation or PlacementStatusHistory.

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
const failWith = (code, extra) => Object.assign(new Error(code), { code, ...extra });

const OFFER_STATUSES = ["SELECTED", "OFFER_ACCEPTED", "OFFER_DECLINED"];
const NEXT_OFFER_STATUSES = { SELECTED: ["OFFER_ACCEPTED", "OFFER_DECLINED"], OFFER_ACCEPTED: [], OFFER_DECLINED: [] };

const studentSummary = { id: true, PRN: true, graduationYear: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } };

const toSelectionSummary = selection => ({ selectionId: selection.id, studentId: selection.studentId, driveId: selection.driveId, status: selection.status, packageLPA: selection.packageLPA, selectedAt: selection.selectedAt });

async function createSelection(req, res) {
  const studentId = validId(req.body?.studentId) ? Number(req.body.studentId) : NaN;
  const driveId = validId(req.body?.driveId) ? Number(req.body.driveId) : NaN;
  // packageLPA is required. A missing, null or malformed value is rejected; the drive's package is never used as a fallback.
  const packageLPA = parsePackageLPA(req.body?.packageLPA);
  if (!validId(studentId) || !validId(driveId)) return error(res, 400, "VALIDATION_ERROR", "studentId and driveId must be positive integers.");
  if (packageLPA === null) return error(res, 400, "VALIDATION_ERROR", "packageLPA is required and must be a positive number.", [{ field: "packageLPA", message: "Send a number greater than 0, for example 12.5." }]);

  try {
    const [student, drive, existing] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { id: true, user: { select: { isActive: true } } } }),
      prisma.placementDrive.findUnique({ where: { id: driveId }, include: { company: { select: { id: true, name: true, isActive: true } }, jobRole: { select: { id: true, title: true, companyId: true } } } }),
      prisma.studentSelection.findUnique({ where: { studentId }, select: { id: true } }),
    ]);
    if (!student) return error(res, 404, "STUDENT_NOT_FOUND", "Student not found.");
    if (!drive) return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    if (!student.user?.isActive) return error(res, 422, "STUDENT_INACTIVE", "Inactive students cannot be selected.");
    if (existing) return error(res, 409, "OFFICIAL_SELECTION_EXISTS", "Student already has an official placement record.", [{ field: "studentId", message: `Existing selectionId: ${existing.id}.` }]);
    // Results are recorded after the recruitment process, so only a cancelled drive is an invalid target.
    if (drive.status === "CANCELLED") return error(res, 422, "DRIVE_CLOSED", "Cannot create a selection for a cancelled drive.");
    if (!drive.company?.isActive) return error(res, 422, "COMPANY_INACTIVE", "The drive's company is inactive.");
    if (!drive.jobRole || drive.jobRole.companyId !== drive.companyId) return error(res, 422, "JOB_ROLE_COMPANY_MISMATCH", "The drive job role must belong to the same company as the drive.");

    const created = await prisma.$transaction(async tx => {
      // The unique studentId constraint is the final concurrency guard; this recheck only gives a clean message.
      const duplicate = await tx.studentSelection.findUnique({ where: { studentId }, select: { id: true } });
      if (duplicate) throw failWith("OFFICIAL_SELECTION_EXISTS");
      // Eligibility is recalculated from the student, academic and drive rows read inside this transaction, using the
      // shared rule engine. evaluateStudentEligibility is a pure function, so it works on transaction data (the service's
      // checkStudentDriveEligibility wrapper always reads through the global client and cannot join a transaction).
      const currentStudent = await tx.student.findUnique({ where: { id: studentId }, include: { selection: true } });
      const currentDrive = await tx.placementDrive.findUnique({ where: { id: driveId }, include: { eligibilityCriteria: true, eligibleBranches: true, eligibleYears: true } });
      if (!currentStudent || !currentDrive) throw failWith("P2025");
      const eligibility = evaluateStudentEligibility(
        currentStudent,
        currentDrive.eligibilityCriteria,
        currentDrive.eligibleBranches.map(branch => branch.departmentId),
        currentDrive.eligibleYears.map(year => year.graduationYear)
      );
      if (!eligibility.isEligible) throw failWith("NOT_ELIGIBLE", { reasons: eligibility.reasons });
      return tx.studentSelection.create({ data: { studentId, driveId, status: "SELECTED", packageLPA } });
    });
    return res.status(201).json({ success: true, message: "Student selection recorded successfully", data: toSelectionSummary(created) });
  } catch (e) {
    if (e.code === "P2002" || e.code === "OFFICIAL_SELECTION_EXISTS") return error(res, 409, "OFFICIAL_SELECTION_EXISTS", "Student already has an official placement record.");
    if (e.code === "NOT_ELIGIBLE") return error(res, 422, "NOT_ELIGIBLE", "Student does not currently meet this drive's eligibility criteria.", e.reasons.map(reason => ({ field: "eligibility", message: reason })));
    if (e.code === "P2003" || e.code === "P2025") return error(res, 404, "RELATED_RECORD_NOT_FOUND", "Student or drive was not found.");
    console.error("createSelection:", e);
    return error(res, 500, "INTERNAL_ERROR", "Failed to record selection.");
  }
}

async function listSelections(req, res) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return error(res, 400, "VALIDATION_ERROR", "page must be positive and limit must be between 1 and 100.");

    const where = {};
    if (req.query.departmentId !== undefined) {
      if (!validId(req.query.departmentId)) return error(res, 400, "VALIDATION_ERROR", "Invalid departmentId.");
      where.student = { ...(where.student || {}), departmentId: Number(req.query.departmentId) };
    }
    if (req.query.graduationYear !== undefined) {
      const year = Number(req.query.graduationYear);
      if (!validId(req.query.graduationYear) || year < 1900 || year > 2200) return error(res, 400, "VALIDATION_ERROR", "Invalid graduationYear.");
      where.student = { ...(where.student || {}), graduationYear: year };
    }
    if (req.query.companyId !== undefined) {
      if (!validId(req.query.companyId)) return error(res, 400, "VALIDATION_ERROR", "Invalid companyId.");
      where.drive = { ...(where.drive || {}), companyId: Number(req.query.companyId) };
    }
    if (req.query.driveId !== undefined) {
      if (!validId(req.query.driveId)) return error(res, 400, "VALIDATION_ERROR", "Invalid driveId.");
      where.driveId = Number(req.query.driveId);
    }
    if (req.query.status !== undefined) {
      if (!OFFER_STATUSES.includes(req.query.status)) return error(res, 400, "VALIDATION_ERROR", "Invalid status.", [{ field: "status", message: `Allowed values: ${OFFER_STATUSES.join(", ")}.` }]);
      where.status = req.query.status;
    }
    if (req.query.search !== undefined) {
      if (typeof req.query.search !== "string") return error(res, 400, "VALIDATION_ERROR", "search must be a string.");
      const term = req.query.search.trim();
      if (term) where.OR = [
        { student: { PRN: { contains: term, mode: "insensitive" } } },
        { student: { user: { name: { contains: term, mode: "insensitive" } } } },
        { drive: { company: { name: { contains: term, mode: "insensitive" } } } },
        { drive: { jobRole: { title: { contains: term, mode: "insensitive" } } } },
      ];
    }

    const sortBy = req.query.sortBy || "selectedAt";
    const sortOrder = req.query.sortOrder || "desc";
    const sortMap = {
      selectedAt: { selectedAt: sortOrder }, packageLPA: { packageLPA: sortOrder }, status: { status: sortOrder },
      department: { student: { department: { name: sortOrder } } }, graduationYear: { student: { graduationYear: sortOrder } },
      academicYear: { student: { graduationYear: sortOrder } }, company: { drive: { company: { name: sortOrder } } }, studentName: { student: { user: { name: sortOrder } } },
    };
    if (!Object.prototype.hasOwnProperty.call(sortMap, sortBy) || !["asc", "desc"].includes(sortOrder)) return error(res, 400, "VALIDATION_ERROR", "Invalid sortBy or sortOrder.", [{ field: "sortBy", message: `Allowed values: ${Object.keys(sortMap).join(", ")}.` }]);

    const [rows, total] = await Promise.all([
      prisma.studentSelection.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: [sortMap[sortBy], { id: "desc" }],
        include: { student: { select: studentSummary }, drive: { include: { company: { select: { id: true, name: true } }, jobRole: { select: { id: true, title: true } } } } },
      }),
      prisma.studentSelection.count({ where }),
    ]);
    const data = rows.map(s => ({
      selectionId: s.id, studentId: s.studentId, driveId: s.driveId, PRN: s.student.PRN, studentName: s.student.user.name,
      department: s.student.department, graduationYear: s.student.graduationYear,
      company: s.drive.company.name, companyId: s.drive.company.id, jobRole: s.drive.jobRole?.title ?? null,
      packageLPA: s.packageLPA, status: s.status, selectedAt: s.selectedAt,
    }));
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { console.error("listSelections:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch selections."); }
}

async function getSelection(req, res) {
  try {
    if (!validId(req.params.selectionId)) return error(res, 400, "VALIDATION_ERROR", "Invalid selectionId.");
    const s = await prisma.studentSelection.findUnique({
      where: { id: Number(req.params.selectionId) },
      include: {
        student: { select: { ...studentSummary, user: { select: { name: true, email: true } } } },
        drive: { include: { company: { select: { id: true, name: true, website: true } }, jobRole: { select: { id: true, title: true, description: true, domain: true } } } },
      },
    });
    if (!s) return error(res, 404, "SELECTION_NOT_FOUND", "Selection not found.");
    return res.json({
      success: true,
      data: {
        selectionId: s.id, studentId: s.studentId, driveId: s.driveId, PRN: s.student.PRN, studentName: s.student.user.name, studentEmail: s.student.user.email,
        department: s.student.department, graduationYear: s.student.graduationYear, company: s.drive.company, jobRole: s.drive.jobRole,
        packageLPA: s.packageLPA, status: s.status, selectedAt: s.selectedAt,
        drive: { id: s.drive.id, title: s.drive.title, driveDate: s.drive.driveDate, status: s.drive.status },
      },
    });
  } catch (e) { console.error("getSelection:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch selection."); }
}

async function updateSelectionStatus(req, res) {
  try {
    const id = Number(req.params.selectionId);
    const status = req.body?.status;
    if (!validId(req.params.selectionId) || !OFFER_STATUSES.includes(status)) return error(res, 400, "VALIDATION_ERROR", "A valid selectionId and status are required.", [{ field: "status", message: `Allowed values: ${OFFER_STATUSES.join(", ")}.` }]);
    const result = await prisma.$transaction(async tx => {
      const current = await tx.studentSelection.findUnique({ where: { id } });
      if (!current) return { notFound: true };
      if (current.status === status) return { data: current };
      if (!NEXT_OFFER_STATUSES[current.status]?.includes(status)) return { invalidTransition: true, currentStatus: current.status };
      // Compare-and-set so accept/decline racing each other cannot both succeed. The selection is never deleted.
      const swapped = await tx.studentSelection.updateMany({ where: { id, status: current.status }, data: { status } });
      if (swapped.count === 0) return { conflict: true };
      return { data: await tx.studentSelection.findUnique({ where: { id } }) };
    });
    if (result.notFound) return error(res, 404, "SELECTION_NOT_FOUND", "Selection not found.");
    if (result.invalidTransition) return error(res, 422, "INVALID_STATUS_TRANSITION", `Cannot change selection status from ${result.currentStatus} to ${status}.`);
    if (result.conflict) return error(res, 409, "CONCURRENT_UPDATE", "The offer status was changed by someone else. Reload and try again.");
    return res.json({ success: true, message: "Offer status updated successfully", data: toSelectionSummary(result.data) });
  } catch (e) { console.error("updateSelectionStatus:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to update offer status."); }
}

async function getMySelection(req, res) {
  try {
    // The student is resolved from the verified JWT user; no studentId is read from the client.
    const student = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!student) return error(res, 404, "STUDENT_NOT_FOUND", "Student profile not found.");
    const s = await prisma.studentSelection.findUnique({
      where: { studentId: student.id },
      include: { drive: { include: { company: { select: { id: true, name: true, website: true } }, jobRole: { select: { id: true, title: true, domain: true } } } } },
    });
    if (!s) return res.json({ success: true, data: null, message: "No official selection record found" });
    return res.json({
      success: true,
      data: {
        selectionId: s.id, studentId: s.studentId, driveId: s.driveId, status: s.status, packageLPA: s.packageLPA, selectedAt: s.selectedAt,
        company: s.drive.company, jobRole: s.drive.jobRole, drive: { id: s.drive.id, title: s.drive.title, driveDate: s.drive.driveDate },
      },
    });
  } catch (e) { console.error("getMySelection:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch selection."); }
}

module.exports = { createSelection, listSelections, getSelection, updateSelectionStatus, getMySelection };