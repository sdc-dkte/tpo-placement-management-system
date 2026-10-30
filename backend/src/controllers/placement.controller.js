const prisma = require("../prismaClient");
// Accept only real positive integers (number, or a string of digits). Number() alone lets [5], true, "1e1" and " 7 " through.
const validId = value => (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const error = (res, status, code, message, details) => res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) }, message });

async function listPlacements(req, res) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return error(res, 400, "VALIDATION_ERROR", "page must be positive and limit must be between 1 and 100.");
    const where = {};
    if (req.query.departmentId !== undefined) {
      const id = Number(req.query.departmentId); if (!validId(req.query.departmentId)) return error(res, 400, "VALIDATION_ERROR", "Invalid departmentId.");
      where.student = { ...(where.student || {}), departmentId: id };
    }
    if (req.query.companyId !== undefined) {
      const id = Number(req.query.companyId); if (!validId(req.query.companyId)) return error(res, 400, "VALIDATION_ERROR", "Invalid companyId.");
      where.drive = { ...(where.drive || {}), companyId: id };
    }
    if (req.query.graduationYear !== undefined) {
      const year = Number(req.query.graduationYear); if (!Number.isInteger(year) || year < 1900 || year > 2200) return error(res, 400, "VALIDATION_ERROR", "Invalid graduationYear.");
      where.student = { ...(where.student || {}), graduationYear: year };
    }
    const validStatuses = ["SELECTED", "OFFER_ACCEPTED", "OFFER_DECLINED"];
    if (req.query.status !== undefined) { if (!validStatuses.includes(req.query.status)) return error(res, 400, "VALIDATION_ERROR", "Invalid status."); where.status = req.query.status; }
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
      prisma.studentSelection.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [sortMap[sortBy], { id: "desc" }], include: {
        student: { select: { id: true, PRN: true, graduationYear: true, user: { select: { name: true } }, department: { select: { id: true, name: true, code: true } } } },
        drive: { include: { company: { select: { id: true, name: true } }, jobRole: { select: { id: true, title: true } } } },
      } }), prisma.studentSelection.count({ where }),
    ]);
    const data = rows.map(s => ({ selectionId: s.id, studentId: s.studentId, PRN: s.student.PRN, studentName: s.student.user.name, department: s.student.department, graduationYear: s.student.graduationYear, company: s.drive.company.name, companyId: s.drive.company.id, jobRole: s.drive.jobRole?.title ?? null, packageLPA: s.packageLPA, status: s.status, selectedAt: s.selectedAt }));
    return res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (e) { console.error("listPlacements:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch placements."); }
}

async function getPlacement(req, res) {
  try {
    const selectionId = Number(req.params.selectionId);
    if (!validId(req.params.selectionId)) return error(res, 400, "VALIDATION_ERROR", "Invalid selectionId.");
    const s = await prisma.studentSelection.findUnique({
      where: { id: selectionId },
      include: {
        student: {
          select: {
            id: true, PRN: true, graduationYear: true,
            user: { select: { name: true, email: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
        drive: {
          include: {
            company: { select: { id: true, name: true, website: true } },
            jobRole: { select: { id: true, title: true, description: true, domain: true } },
          },
        },
      },
    });
    if (!s) return error(res, 404, "PLACEMENT_NOT_FOUND", "Placement not found.");
    return res.json({ success: true, data: { selectionId: s.id, studentId: s.studentId, PRN: s.student.PRN, studentName: s.student.user.name, studentEmail: s.student.user.email, department: s.student.department, graduationYear: s.student.graduationYear, company: s.drive.company, jobRole: s.drive.jobRole, packageLPA: s.packageLPA, status: s.status, selectedAt: s.selectedAt, drive: { id: s.drive.id, title: s.drive.title, driveDate: s.drive.driveDate, status: s.drive.status } } });
  } catch (e) { console.error("getPlacement:", e); return error(res, 500, "INTERNAL_ERROR", "Failed to fetch placement."); }
}

module.exports = { listPlacements, getPlacement };
