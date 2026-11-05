const prisma = require("../prismaClient");
const { createOfficialSelection } = require("../services/selection.service");

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
  const studentId = validId(req.body?.studentId)
    ? Number(req.body.studentId)
    : NaN;

  const driveId = validId(req.body?.driveId)
    ? Number(req.body.driveId)
    : NaN;

  const packageLPA = parsePackageLPA(req.body?.packageLPA);

  if (!validId(studentId) || !validId(driveId)) {
    return error(
      res,
      400,
      "VALIDATION_ERROR",
      "studentId and driveId must be positive integers."
    );
  }

  if (packageLPA === null) {
    return error(
      res,
      400,
      "VALIDATION_ERROR",
      "packageLPA is required and must be a positive number.",
      [{ field: "packageLPA", message: "Send a number greater than 0, for example 12.5." }]
    );
  }

  try {
    const [student, drive] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          user: { select: { isActive: true } },
        },
      }),

      prisma.placementDrive.findUnique({
        where: { id: driveId },
        include: {
          company: {
            select: { id: true, name: true, isActive: true },
          },
          jobRole: {
            select: { id: true, title: true, companyId: true },
          },
        },
      }),
    ]);

    if (!student) {
      return error(res, 404, "STUDENT_NOT_FOUND", "Student not found.");
    }

    if (!drive) {
      return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    }

    if (!student.user?.isActive) {
      return error(res, 422, "STUDENT_INACTIVE", "Inactive students cannot be selected.");
    }

    if (drive.status === "CANCELLED") {
      return error(res, 422, "DRIVE_CLOSED", "Cannot create a selection for a cancelled drive.");
    }

    if (!drive.company?.isActive) {
      return error(res, 422, "COMPANY_INACTIVE", "The drive's company is inactive.");
    }

    if (!drive.jobRole || drive.jobRole.companyId !== drive.companyId) {
      return error(
        res,
        422,
        "JOB_ROLE_COMPANY_MISMATCH",
        "The drive job role must belong to the same company as the drive."
      );
    }

    const created = await prisma.$transaction(tx =>
      createOfficialSelection(tx, { studentId, driveId, packageLPA })
    );

    return res.status(201).json({
      success: true,
      message: "Student selection recorded successfully",
      data: toSelectionSummary(created),
    });
  } catch (e) {
    if (e.code === "P2002" || e.code === "OFFICIAL_SELECTION_EXISTS") {
      return error(res, 409, "OFFICIAL_SELECTION_EXISTS", "Student already has an official placement record.");
    }

    if (e.code === "STUDENT_INACTIVE") {
      return error(res, 422, "STUDENT_INACTIVE", "Inactive students cannot be selected.");
    }

    if (e.code === "NOT_ELIGIBLE") {
      return error(
        res,
        422,
        "NOT_ELIGIBLE",
        "Student does not currently meet this drive's eligibility criteria.",
        (e.reasons || []).map(reason => ({
          field: "eligibility",
          message: reason,
        }))
      );
    }

    if (e.code === "P2003" || e.code === "P2025") {
      return error(res, 404, "RELATED_RECORD_NOT_FOUND", "Student or drive was not found.");
    }

    if (e.code === "DRIVE_CLOSED") {
      return error(res, 422, "DRIVE_CLOSED",
        "Cannot create a selection for a cancelled drive.");
    }

    if (e.code === "COMPANY_INACTIVE") {
      return error(res, 422, "COMPANY_INACTIVE",
        "The drive's company is inactive.");
    }

    if (e.code === "JOB_ROLE_COMPANY_MISMATCH") {
      return error(res, 422, "JOB_ROLE_COMPANY_MISMATCH",
        "The drive job role must belong to the same company as the drive.");
    }

    console.error("createSelection:", e);
    return error(res, 500, "INTERNAL_ERROR", "Failed to record selection.");
  }
}


const PRN_REGEX = /^\d{2}[A-Z]{3}\d{3}$/;
const MAX_BULK_SIZE = 100;

async function bulkCreateSelections(req, res) {
  const driveId = validId(req.body?.driveId)
    ? Number(req.body.driveId)
    : NaN;

  const packageLPA = parsePackageLPA(req.body?.packageLPA);
  const prns = req.body?.prns;

  // Request-level validation
  if (!validId(driveId)) {
    return error(res, 400, "VALIDATION_ERROR", "driveId must be a positive integer.");
  }

  if (packageLPA === null) {
    return error(res, 400, "VALIDATION_ERROR", "packageLPA must be a positive number.");
  }

  if (!Array.isArray(prns) || prns.length === 0) {
    return error(res, 400, "VALIDATION_ERROR", "prns must be a non-empty array.");
  }

  if (prns.length > MAX_BULK_SIZE) {
    return error(res, 400, "VALIDATION_ERROR", `A maximum of ${MAX_BULK_SIZE} PRNs is allowed.`);
  }

  if (prns.some(prn => typeof prn !== "string")) {
    return error(res, 400, "VALIDATION_ERROR", "Every PRN must be a string.");
  }

  try {
    // Validate the common drive once before processing individual students.
    const drive = await prisma.placementDrive.findUnique({
      where: { id: driveId },
      include: {
        company: { select: { id: true, isActive: true } },
        jobRole: { select: { id: true, companyId: true } },
      },
    });

    if (!drive) {
      return error(res, 404, "DRIVE_NOT_FOUND", "Placement drive not found.");
    }

    if (drive.status === "CANCELLED") {
      return error(res, 422, "DRIVE_CLOSED", "Cannot create selections for a cancelled drive.");
    }

    if (!drive.company?.isActive) {
      return error(res, 422, "COMPANY_INACTIVE", "The drive's company is inactive.");
    }

    if (!drive.jobRole || drive.jobRole.companyId !== drive.companyId) {
      return error(res, 422, "JOB_ROLE_COMPANY_MISMATCH", "The drive job role must belong to the same company as the drive.");
    }

    const seenPRNs = new Set();
    const results = [];

    // Sequential processing avoids overwhelming the database.
    for (const rawPRN of prns) {
      const prn = rawPRN.trim().toUpperCase();

      if (!PRN_REGEX.test(prn)) {
        results.push({
          prn: rawPRN,
          status: "FAILED",
          code: "INVALID_PRN_FORMAT",
          message: "PRN must contain 2 digits, 3 uppercase letters and 3 digits.",
        });
        continue;
      }

      if (seenPRNs.has(prn)) {
        results.push({
          prn,
          status: "SKIPPED",
          code: "DUPLICATE_IN_REQUEST",
          message: "This PRN has already appeared in the request.",
        });
        continue;
      }

      seenPRNs.add(prn);

      try {
        const student = await prisma.student.findUnique({
          where: { PRN: prn },
          select: { id: true },
        });

        if (!student) {
          results.push({
            prn,
            status: "FAILED",
            code: "STUDENT_NOT_FOUND",
            message: "No student found for this PRN.",
          });
          continue;
        }

        const created = await prisma.$transaction(tx =>
          createOfficialSelection(tx, {
            studentId: student.id,
            driveId,
            packageLPA,
          })
        );

        results.push({
          prn,
          status: "SUCCESS",
          selectionId: created.id,
        });
      } catch (e) {
        if (e.code === "P2002" || e.code === "OFFICIAL_SELECTION_EXISTS") {
          results.push({
            prn,
            status: "SKIPPED",
            code: "ALREADY_SELECTED",
            message: "Student already has an official selection.",
          });
        } else if (e.code === "STUDENT_INACTIVE") {
          results.push({
            prn,
            status: "FAILED",
            code: "STUDENT_INACTIVE",
            message: "Inactive students cannot be selected.",
          });
        } else if (e.code === "NOT_ELIGIBLE") {
          results.push({
            prn,
            status: "FAILED",
            code: "NOT_ELIGIBLE",
            message: "Student does not meet the drive eligibility criteria.",
            reasons: e.reasons || [],
          });
        } else if (e.code === "P2025" || e.code === "P2003") {
          results.push({
            prn,
            status: "FAILED",
            code: "RELATED_RECORD_NOT_FOUND",
            message: "A related student or drive record was not found.",
          });
        } else {
          console.error(`bulkCreateSelections (${prn}):`, e);
          results.push({
            prn,
            status: "FAILED",
            code: "INTERNAL_ERROR",
            message: "Failed to record this student's selection.",
          });
        }
      }
    }

    const successful = results.filter(r => r.status === "SUCCESS").length;
    const failed = results.filter(r => r.status === "FAILED").length;
    const skipped = results.filter(r => r.status === "SKIPPED").length;

    return res.status(200).json({
      success: true,
      message: "Bulk selection processing completed.",
      data: {
        total: results.length,
        successful,
        failed,
        skipped,
        results,
      },
    });
  } catch (e) {
    console.error("bulkCreateSelections:", e);
    return error(res, 500, "INTERNAL_ERROR", "Failed to process bulk selections.");
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


module.exports = {
  createSelection,
  bulkCreateSelections,
  listSelections,
  getSelection,
  updateSelectionStatus,
  getMySelection,
};