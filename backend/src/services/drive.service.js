const prisma = require("../prismaClient");

const VALID_DRIVE_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"];

const ALLOWED_STATUS_TRANSITIONS = {
    UPCOMING: ["ONGOING", "CANCELLED"],
    ONGOING: ["COMPLETED", "CANCELLED"],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
};

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Throws a structured error with a statusCode property.
 */
const fail = (message, statusCode) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    throw err;
};

/**
 * Parses and validates a numeric ID from an untrusted value.
 * Throws 400 if the value is not a positive integer.
 */
const parseId = (value, fieldName) => {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n <= 0) {
        fail(`"${fieldName}" must be a positive integer. Received: ${value}`, 400);
    }
    return n;
};

/**
 * Parses and validates a percentage value (0–100).
 */
const parsePercentage = (value, fieldName) => {
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > 100) {
        fail(`"${fieldName}" must be a number between 0 and 100. Received: ${value}`, 400);
    }
    return n;
};

/**
 * Parses and validates a CGPA value (0–10).
 */
const parseCGPA = (value) => {
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > 10) {
        fail(`"minimumCGPA" must be a number between 0 and 10. Received: ${value}`, 400);
    }
    return n;
};

/**
 * Parses and validates a non-negative integer (for backlogs, grad year, etc.).
 */
const parseNonNegativeInt = (value, fieldName) => {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < 0) {
        fail(`"${fieldName}" must be a non-negative integer. Received: ${value}`, 400);
    }
    return n;
};

/**
 * Validates and parses an ISO date string. Returns a Date or null.
 */
const parseDate = (value, fieldName) => {
    if (value === null || value === undefined || value === "") return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        fail(`"${fieldName}" must be a valid ISO date string. Received: ${value}`, 400);
    }
    return d;
};

/**
 * Validates an array of positive integer IDs.
 */
const parseIdArray = (arr, fieldName) => {
    if (!Array.isArray(arr)) {
        fail(`"${fieldName}" must be an array.`, 400);
    }
    const result = arr.map((v, i) => {
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n <= 0) {
            fail(`"${fieldName}[${i}]" must be a positive integer. Received: ${v}`, 400);
        }
        return n;
    });
    return result;
};

/**
 * Validates an array of graduation years (integers between 2000 and 2100).
 */
const parseYearArray = (arr) => {
    if (!Array.isArray(arr)) {
        fail('"graduationYears" must be an array.', 400);
    }
    return arr.map((v, i) => {
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n < 2000 || n > 2100) {
            fail(
                `"graduationYears[${i}]" must be a valid year between 2000 and 2100. Received: ${v}`,
                400
            );
        }
        return n;
    });
};

/**
 * Validates and normalises the eligibility sub-object from a request.
 * Returns a cleaned object or null if no eligibility block was provided.
 */
const validateAndNormaliseEligibility = (eligibility) => {
    if (!eligibility || typeof eligibility !== "object") return null;

    const out = {
        minimumCGPA: 0,
        minimumTenth: 0,
        minimumTwelfth: null,
        minimumDiplomaPercentage: null,
        maximumBacklogs: 0,
        allowPreviousPlacement: false,
        departmentIds: [],
        graduationYears: [],
    };

    if (eligibility.minimumCGPA !== undefined && eligibility.minimumCGPA !== null) {
        out.minimumCGPA = parseCGPA(eligibility.minimumCGPA);
    }
    if (eligibility.minimumTenth !== undefined && eligibility.minimumTenth !== null) {
        out.minimumTenth = parsePercentage(eligibility.minimumTenth, "minimumTenth");
    }
    if (eligibility.minimumTwelfth !== undefined && eligibility.minimumTwelfth !== null) {
        out.minimumTwelfth = parsePercentage(eligibility.minimumTwelfth, "minimumTwelfth");
    }
    if (eligibility.minimumDiplomaPercentage !== undefined && eligibility.minimumDiplomaPercentage !== null) {
        out.minimumDiplomaPercentage = parsePercentage(
            eligibility.minimumDiplomaPercentage,
            "minimumDiplomaPercentage"
        );
    }
    if (eligibility.maximumBacklogs !== undefined && eligibility.maximumBacklogs !== null) {
        out.maximumBacklogs = parseNonNegativeInt(eligibility.maximumBacklogs, "maximumBacklogs");
    }
    if (eligibility.allowPreviousPlacement !== undefined) {
        if (typeof eligibility.allowPreviousPlacement !== "boolean") {
            fail('"allowPreviousPlacement" must be a boolean.', 400);
        }
        out.allowPreviousPlacement = eligibility.allowPreviousPlacement;
    }
    if (eligibility.departmentIds !== undefined) {
        out.departmentIds = parseIdArray(eligibility.departmentIds, "departmentIds");
    }
    if (eligibility.graduationYears !== undefined) {
        out.graduationYears = parseYearArray(eligibility.graduationYears);
    }

    return out;
};

/**
 * Verifies that all given department IDs exist in the database.
 * Throws 404 with the list of missing IDs if any are not found.
 */
const assertDepartmentsExist = async (departmentIds) => {
    if (!departmentIds || departmentIds.length === 0) return;

    const found = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true },
    });

    const foundSet = new Set(found.map((d) => d.id));
    const missing = departmentIds.filter((id) => !foundSet.has(id));

    if (missing.length > 0) {
        fail(`Department IDs not found: ${missing.join(", ")}.`, 404);
    }
};

/**
 * Shared include block used when returning a full drive record.
 */
const DRIVE_FULL_INCLUDE = {
    company: { select: { id: true, name: true, website: true, description: true } },
    jobRole: { select: { id: true, title: true, description: true, domain: true } },
    eligibilityCriteria: true,
    eligibleBranches: {
        include: { department: { select: { id: true, name: true, code: true } } },
    },
    eligibleYears: { select: { graduationYear: true } },
};

/**
 * Formats a raw Prisma drive record into the standard API response shape.
 */
const formatDrive = (drive) => ({
    id: drive.id,
    title: drive.title,
    packageLPA: drive.packageLPA,
    driveDate: drive.driveDate,
    applicationDeadline: drive.applicationDeadline,
    status: drive.status,
    venue: drive.venue,
    hiringProcess: drive.hiringProcess,
    createdAt: drive.createdAt,
    updatedAt: drive.updatedAt,
    company: drive.company,
    jobRole: drive.jobRole,
    eligibility: {
        minimumCGPA: drive.eligibilityCriteria?.minimumCGPA ?? 0,
        minimumTenth: drive.eligibilityCriteria?.minimumTenth ?? 0,
        minimumTwelfth: drive.eligibilityCriteria?.minimumTwelfth ?? null,
        minimumDiplomaPercentage: drive.eligibilityCriteria?.minimumDiplomaPercentage ?? null,
        maximumBacklogs: drive.eligibilityCriteria?.maximumBacklogs ?? 0,
        allowPreviousPlacement: drive.eligibilityCriteria?.allowPreviousPlacement ?? false,
        departments: (drive.eligibleBranches || []).map((b) => ({
            id: b.department.id,
            name: b.department.name,
            code: b.department.code,
        })),
        departmentIds: (drive.eligibleBranches || []).map((b) => b.department.id),
        graduationYears: (drive.eligibleYears || []).map((y) => y.graduationYear),
    },
});

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Creates a new placement drive atomically with its eligibility criteria.
 */
const createPlacementDrive = async (payload) => {
    const {
        companyId: rawCompanyId,
        jobRoleId: rawJobRoleId,
        title,
        packageLPA,
        driveDate: rawDriveDate,
        applicationDeadline: rawDeadline,
        status = "UPCOMING",
        venue,
        hiringProcess,
        eligibility: rawEligibility,
    } = payload;

    // --- Required field presence ---
    if (!rawCompanyId) fail('"companyId" is required.', 400);
    if (!rawJobRoleId) fail('"jobRoleId" is required.', 400);
    if (!title || !String(title).trim()) fail('"title" is required and cannot be blank.', 400);
    if (packageLPA === undefined || packageLPA === null) fail('"packageLPA" is required.', 400);

    // --- ID validation ---
    const companyId = parseId(rawCompanyId, "companyId");
    const jobRoleId = parseId(rawJobRoleId, "jobRoleId");

    // --- Package ---
    const parsedPackage = Number(packageLPA);
    if (Number.isNaN(parsedPackage) || parsedPackage <= 0) {
        fail('"packageLPA" must be a positive number.', 400);
    }

    // --- Status ---
    const driveStatus = String(status).toUpperCase();
    if (!VALID_DRIVE_STATUSES.includes(driveStatus)) {
        fail(
            `Invalid status "${status}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`,
            400
        );
    }

    // --- Dates ---
    const parsedDriveDate = parseDate(rawDriveDate, "driveDate");
    const parsedDeadline = parseDate(rawDeadline, "applicationDeadline");
    if (parsedDriveDate && parsedDeadline && parsedDeadline > parsedDriveDate) {
        fail("Application deadline cannot be after the scheduled drive date.", 422);
    }

    // --- Eligibility block ---
    const eligibility = validateAndNormaliseEligibility(rawEligibility);

    // --- DB lookups ---
    const [company, jobRole] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId } }),
        prisma.jobRole.findUnique({ where: { id: jobRoleId } }),
    ]);

    if (!company) fail(`Company with ID ${companyId} was not found.`, 404);
    if (!jobRole) fail(`Job role with ID ${jobRoleId} was not found.`, 404);
    if (jobRole.companyId !== companyId) {
        fail(
            `Job role "${jobRole.title}" does not belong to company "${company.name}".`,
            422
        );
    }

    if (eligibility) {
        await assertDepartmentsExist(eligibility.departmentIds);
    }

    // --- Atomic transaction ---
    return await prisma.$transaction(async (tx) => {
        const createdDrive = await tx.placementDrive.create({
            data: {
                companyId,
                jobRoleId,
                title: title.trim(),
                packageLPA: parsedPackage,
                driveDate: parsedDriveDate,
                applicationDeadline: parsedDeadline,
                status: driveStatus,
                venue: venue ? String(venue).trim() : null,
                hiringProcess: hiringProcess ? String(hiringProcess).trim() : null,
            },
        });

        if (eligibility) {
            await tx.eligibilityCriteria.create({
                data: {
                    driveId: createdDrive.id,
                    minimumCGPA: eligibility.minimumCGPA,
                    minimumTenth: eligibility.minimumTenth,
                    minimumTwelfth: eligibility.minimumTwelfth,
                    minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage,
                    maximumBacklogs: eligibility.maximumBacklogs,
                    allowPreviousPlacement: eligibility.allowPreviousPlacement,
                },
            });

            if (eligibility.departmentIds.length > 0) {
                await tx.driveEligibleBranch.createMany({
                    data: eligibility.departmentIds.map((deptId) => ({
                        driveId: createdDrive.id,
                        departmentId: deptId,
                    })),
                    skipDuplicates: true,
                });
            }

            if (eligibility.graduationYears.length > 0) {
                await tx.driveEligibleYear.createMany({
                    data: eligibility.graduationYears.map((yr) => ({
                        driveId: createdDrive.id,
                        graduationYear: yr,
                    })),
                    skipDuplicates: true,
                });
            }
        }

        const full = await tx.placementDrive.findUnique({
            where: { id: createdDrive.id },
            include: DRIVE_FULL_INCLUDE,
        });

        return formatDrive(full);
    });
};

/**
 * Lists all drives with filtering, search, and pagination.
 */
const getAllPlacementDrives = async (query = {}) => {
    const {
        page,
        limit,
        companyId,
        jobRoleId,
        status,
        departmentId,
        graduationYear,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (companyId !== undefined) {
        where.companyId = parseId(companyId, "companyId");
    }
    if (jobRoleId !== undefined) {
        where.jobRoleId = parseId(jobRoleId, "jobRoleId");
    }
    if (status !== undefined) {
        const upperStatus = String(status).toUpperCase();
        if (!VALID_DRIVE_STATUSES.includes(upperStatus)) {
            fail(
                `Invalid status filter "${status}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`,
                400
            );
        }
        where.status = upperStatus;
    }
    if (departmentId !== undefined) {
        where.eligibleBranches = { some: { departmentId: parseId(departmentId, "departmentId") } };
    }
    if (graduationYear !== undefined) {
        const yr = parseInt(graduationYear, 10);
        if (!Number.isInteger(yr) || yr < 2000 || yr > 2100) {
            fail('"graduationYear" must be a valid year between 2000 and 2100.', 400);
        }
        where.eligibleYears = { some: { graduationYear: yr } };
    }

    if (search && String(search).trim()) {
        const term = String(search).trim();
        where.OR = [
            { title: { contains: term, mode: "insensitive" } },
            { company: { name: { contains: term, mode: "insensitive" } } },
            { jobRole: { title: { contains: term, mode: "insensitive" } } },
            { venue: { contains: term, mode: "insensitive" } },
        ];
    }

    const ALLOWED_SORT = ["createdAt", "driveDate", "applicationDeadline", "packageLPA", "title", "status"];
    const sortField = ALLOWED_SORT.includes(sortBy) ? sortBy : "createdAt";
    const sortDir = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";

    const [total, drives] = await Promise.all([
        prisma.placementDrive.count({ where }),
        prisma.placementDrive.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { [sortField]: sortDir },
            include: {
                ...DRIVE_FULL_INCLUDE,
                _count: { select: { participations: true, selections: true } },
            },
        }),
    ]);

    const data = drives.map((d) => ({
        ...formatDrive(d),
        participationsCount: d._count.participations,
        selectionsCount: d._count.selections,
    }));

    return {
        data,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
        },
    };
};

/**
 * Retrieves a single drive by ID with full details.
 */
const getPlacementDriveById = async (rawDriveId) => {
    const driveId = parseId(rawDriveId, "driveId");

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveId },
        include: {
            ...DRIVE_FULL_INCLUDE,
            _count: { select: { participations: true, selections: true, emailCampaigns: true } },
        },
    });

    if (!drive) return null;

    return {
        ...formatDrive(drive),
        counts: {
            participations: drive._count.participations,
            selections: drive._count.selections,
            campaigns: drive._count.emailCampaigns,
        },
    };
};

/**
 * Updates a placement drive (partial update). Eligibility block is optional.
 */
const updatePlacementDrive = async (rawDriveId, payload) => {
    const driveId = parseId(rawDriveId, "driveId");

    const existing = await prisma.placementDrive.findUnique({
        where: { id: driveId },
        include: { eligibilityCriteria: true },
    });
    if (!existing) fail(`Placement drive with ID ${driveId} was not found.`, 404);

    const {
        title,
        packageLPA,
        driveDate: rawDriveDate,
        applicationDeadline: rawDeadline,
        status,
        venue,
        hiringProcess,
        companyId: rawCompanyId,
        jobRoleId: rawJobRoleId,
        eligibility: rawEligibility,
    } = payload;

    const dataToUpdate = {};

    if (title !== undefined) {
        if (!String(title).trim()) fail('"title" cannot be blank.', 400);
        dataToUpdate.title = String(title).trim();
    }

    if (packageLPA !== undefined) {
        const pkg = Number(packageLPA);
        if (Number.isNaN(pkg) || pkg <= 0) fail('"packageLPA" must be a positive number.', 400);
        dataToUpdate.packageLPA = pkg;
    }

    if (venue !== undefined) {
        dataToUpdate.venue = venue ? String(venue).trim() : null;
    }

    if (hiringProcess !== undefined) {
        dataToUpdate.hiringProcess = hiringProcess ? String(hiringProcess).trim() : null;
    }

    if (rawDriveDate !== undefined) {
        dataToUpdate.driveDate = parseDate(rawDriveDate, "driveDate");
    }

    if (rawDeadline !== undefined) {
        dataToUpdate.applicationDeadline = parseDate(rawDeadline, "applicationDeadline");
    }

    // Cross-field date check using the merged final values
    const finalDriveDate =
        "driveDate" in dataToUpdate ? dataToUpdate.driveDate : existing.driveDate;
    const finalDeadline =
        "applicationDeadline" in dataToUpdate
            ? dataToUpdate.applicationDeadline
            : existing.applicationDeadline;

    if (finalDriveDate && finalDeadline && finalDeadline > finalDriveDate) {
        fail("Application deadline cannot be after the scheduled drive date.", 422);
    }

    // Company / JobRole cross-validation
    const updatingCompany = rawCompanyId !== undefined;
    const updatingRole = rawJobRoleId !== undefined;

    if (updatingCompany || updatingRole) {
        const finalCompanyId = updatingCompany
            ? parseId(rawCompanyId, "companyId")
            : existing.companyId;
        const finalJobRoleId = updatingRole
            ? parseId(rawJobRoleId, "jobRoleId")
            : existing.jobRoleId;

        const role = await prisma.jobRole.findUnique({ where: { id: finalJobRoleId } });
        if (!role) fail(`Job role with ID ${finalJobRoleId} not found.`, 404);
        if (role.companyId !== finalCompanyId) {
            fail("Selected job role does not belong to the selected company.", 422);
        }

        dataToUpdate.companyId = finalCompanyId;
        dataToUpdate.jobRoleId = finalJobRoleId;
    }

    // Status — only validate here; lifecycle transition is via PATCH /status
    if (status !== undefined) {
        const upperStatus = String(status).toUpperCase();
        if (!VALID_DRIVE_STATUSES.includes(upperStatus)) {
            fail(
                `Invalid status "${status}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`,
                400
            );
        }
        dataToUpdate.status = upperStatus;
    }

    // Eligibility
    const eligibility = validateAndNormaliseEligibility(rawEligibility);
    if (eligibility) {
        await assertDepartmentsExist(eligibility.departmentIds);
    }

    return await prisma.$transaction(async (tx) => {
        await tx.placementDrive.update({ where: { id: driveId }, data: dataToUpdate });

        if (eligibility) {
            await tx.eligibilityCriteria.upsert({
                where: { driveId },
                update: {
                    minimumCGPA: eligibility.minimumCGPA,
                    minimumTenth: eligibility.minimumTenth,
                    minimumTwelfth: eligibility.minimumTwelfth,
                    minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage,
                    maximumBacklogs: eligibility.maximumBacklogs,
                    allowPreviousPlacement: eligibility.allowPreviousPlacement,
                },
                create: {
                    driveId,
                    minimumCGPA: eligibility.minimumCGPA,
                    minimumTenth: eligibility.minimumTenth,
                    minimumTwelfth: eligibility.minimumTwelfth,
                    minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage,
                    maximumBacklogs: eligibility.maximumBacklogs,
                    allowPreviousPlacement: eligibility.allowPreviousPlacement,
                },
            });

            if (Array.isArray(eligibility.departmentIds)) {
                await tx.driveEligibleBranch.deleteMany({ where: { driveId } });
                if (eligibility.departmentIds.length > 0) {
                    await tx.driveEligibleBranch.createMany({
                        data: eligibility.departmentIds.map((id) => ({ driveId, departmentId: id })),
                        skipDuplicates: true,
                    });
                }
            }

            if (Array.isArray(eligibility.graduationYears)) {
                await tx.driveEligibleYear.deleteMany({ where: { driveId } });
                if (eligibility.graduationYears.length > 0) {
                    await tx.driveEligibleYear.createMany({
                        data: eligibility.graduationYears.map((yr) => ({ driveId, graduationYear: yr })),
                        skipDuplicates: true,
                    });
                }
            }
        }

        const full = await tx.placementDrive.findUnique({
            where: { id: driveId },
            include: DRIVE_FULL_INCLUDE,
        });

        return formatDrive(full);
    });
};

/**
 * Updates drive status with strict lifecycle transition validation.
 * The drive record is NOT modified if the transition is invalid.
 */
const updatePlacementDriveStatus = async (rawDriveId, newStatus) => {
    const driveId = parseId(rawDriveId, "driveId");

    if (!newStatus || !String(newStatus).trim()) {
        fail('"status" is required.', 400);
    }

    const targetStatus = String(newStatus).toUpperCase();
    if (!VALID_DRIVE_STATUSES.includes(targetStatus)) {
        fail(
            `Invalid status "${newStatus}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`,
            400
        );
    }

    // Fetch current status BEFORE any write
    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveId },
        select: { id: true, title: true, status: true },
    });
    if (!drive) fail(`Placement drive with ID ${driveId} was not found.`, 404);

    if (drive.status === targetStatus) {
        return {
            id: drive.id,
            title: drive.title,
            status: drive.status,
            message: `Drive is already in "${targetStatus}" status. No changes made.`,
        };
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[drive.status] || [];
    if (!allowed.includes(targetStatus)) {
        // Validation failed — drive is NOT touched
        fail(
            `Cannot transition drive status from "${drive.status}" to "${targetStatus}". ` +
                `Allowed transitions from "${drive.status}": ${
                    allowed.length ? allowed.join(", ") : "none (terminal state)"
                }.`,
            422
        );
    }

    const updated = await prisma.placementDrive.update({
        where: { id: driveId },
        data: { status: targetStatus },
        select: { id: true, title: true, status: true, updatedAt: true },
    });

    return updated;
};

/**
 * Replaces eligibility criteria, branches, and years atomically for a drive.
 */
const replaceEligibilityCriteria = async (rawDriveId, payload) => {
    const driveId = parseId(rawDriveId, "driveId");

    const drive = await prisma.placementDrive.findUnique({ where: { id: driveId } });
    if (!drive) fail(`Placement drive with ID ${driveId} was not found.`, 404);

    // Full validation of all criteria fields
    const eligibility = validateAndNormaliseEligibility({
        minimumCGPA: payload.minimumCGPA ?? 0,
        minimumTenth: payload.minimumTenth ?? 0,
        minimumTwelfth: payload.minimumTwelfth ?? null,
        minimumDiplomaPercentage: payload.minimumDiplomaPercentage ?? null,
        maximumBacklogs: payload.maximumBacklogs ?? 0,
        allowPreviousPlacement: payload.allowPreviousPlacement ?? false,
        departmentIds: payload.departmentIds ?? [],
        graduationYears: payload.graduationYears ?? [],
    });

    await assertDepartmentsExist(eligibility.departmentIds);

    return await prisma.$transaction(async (tx) => {
        const criteria = await tx.eligibilityCriteria.upsert({
            where: { driveId },
            update: {
                minimumCGPA: eligibility.minimumCGPA,
                minimumTenth: eligibility.minimumTenth,
                minimumTwelfth: eligibility.minimumTwelfth,
                minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage,
                maximumBacklogs: eligibility.maximumBacklogs,
                allowPreviousPlacement: eligibility.allowPreviousPlacement,
            },
            create: {
                driveId,
                minimumCGPA: eligibility.minimumCGPA,
                minimumTenth: eligibility.minimumTenth,
                minimumTwelfth: eligibility.minimumTwelfth,
                minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage,
                maximumBacklogs: eligibility.maximumBacklogs,
                allowPreviousPlacement: eligibility.allowPreviousPlacement,
            },
        });

        await tx.driveEligibleBranch.deleteMany({ where: { driveId } });
        if (eligibility.departmentIds.length > 0) {
            await tx.driveEligibleBranch.createMany({
                data: eligibility.departmentIds.map((id) => ({ driveId, departmentId: id })),
                skipDuplicates: true,
            });
        }

        await tx.driveEligibleYear.deleteMany({ where: { driveId } });
        if (eligibility.graduationYears.length > 0) {
            await tx.driveEligibleYear.createMany({
                data: eligibility.graduationYears.map((yr) => ({ driveId, graduationYear: yr })),
                skipDuplicates: true,
            });
        }

        const branches = await tx.driveEligibleBranch.findMany({
            where: { driveId },
            include: { department: { select: { id: true, name: true, code: true } } },
        });
        const years = await tx.driveEligibleYear.findMany({
            where: { driveId },
            select: { graduationYear: true },
        });

        return {
            driveId,
            minimumCGPA: criteria.minimumCGPA,
            minimumTenth: criteria.minimumTenth,
            minimumTwelfth: criteria.minimumTwelfth,
            minimumDiplomaPercentage: criteria.minimumDiplomaPercentage,
            maximumBacklogs: criteria.maximumBacklogs,
            allowPreviousPlacement: criteria.allowPreviousPlacement,
            departmentIds: branches.map((b) => b.departmentId),
            departments: branches.map((b) => b.department),
            graduationYears: years.map((y) => y.graduationYear),
        };
    });
};

module.exports = {
    VALID_DRIVE_STATUSES,
    ALLOWED_STATUS_TRANSITIONS,
    createPlacementDrive,
    getAllPlacementDrives,
    getPlacementDriveById,
    updatePlacementDrive,
    updatePlacementDriveStatus,
    replaceEligibilityCriteria,
};
