const prisma = require("../prismaClient");

const VALID_DRIVE_STATUSES = ["UPCOMING", "ONGOING", "COMPLETED", "CANCELLED"];

const ALLOWED_STATUS_TRANSITIONS = {
    UPCOMING: ["ONGOING", "CANCELLED"],
    ONGOING: ["COMPLETED", "CANCELLED", "UPCOMING"],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
};

//helper functions

const parsePositiveInteger = (value, fieldName) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) {
        const error = new Error(`${fieldName} must be a positive integer.`);
        error.statusCode = 400;
        throw error;
    }
    return n;
};

const validateEligibilityCriteria = (eligibility) => {
    if (!eligibility || typeof eligibility !== "object" || Array.isArray(eligibility)) {
        const error = new Error("Eligibility criteria must be a valid object.");
        error.statusCode = 400;
        throw error;
    }

    const validateRange = (field, value, min, max) => {
        if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < min ||
            value > max
        ) {
            const error = new Error(
                `${field} must be a number between ${min} and ${max}.`
            );
            error.statusCode = 400;
            throw error;
        }
    };

    if (eligibility.minimumCGPA !== undefined) {
        validateRange("minimumCGPA", eligibility.minimumCGPA, 0, 10);
    }

    if (eligibility.minimumTenth !== undefined) {
        validateRange("minimumTenth", eligibility.minimumTenth, 0, 100);
    }

    if (eligibility.minimumTwelfth != null) {
        validateRange("minimumTwelfth", eligibility.minimumTwelfth, 0, 100);
    }

    if (eligibility.minimumDiplomaPercentage != null) {
        validateRange(
            "minimumDiplomaPercentage",
            eligibility.minimumDiplomaPercentage,
            0,
            100
        );
    }

    if (eligibility.maximumBacklogs !== undefined) {
        if (
            !Number.isInteger(eligibility.maximumBacklogs) ||
            eligibility.maximumBacklogs < 0 ||
            eligibility.maximumBacklogs > 100
        ) {
            const error = new Error(
                "maximumBacklogs must be an integer between 0 and 100."
            );
            error.statusCode = 400;
            throw error;
        }

    }

    if (
        eligibility.allowPreviousPlacement !== undefined &&
        typeof eligibility.allowPreviousPlacement !== "boolean"
    ) {
        const error = new Error("allowPreviousPlacement must be a boolean.");
        error.statusCode = 400;
        throw error;
    }

    if (eligibility.departmentIds !== undefined) {
        if (
            !Array.isArray(eligibility.departmentIds) ||
            eligibility.departmentIds.some(
                (id) => !Number.isSafeInteger(id) || id <= 0
            ) ||
            new Set(eligibility.departmentIds).size !== eligibility.departmentIds.length
        ) {
            const error = new Error(
                "departmentIds must contain unique positive integers."
            );
            error.statusCode = 400;
            throw error;
        }
    }

    if (eligibility.graduationYears !== undefined) {
        if (
            !Array.isArray(eligibility.graduationYears) ||
            eligibility.graduationYears.some(
                (year) =>
                    !Number.isInteger(year) ||
                    year < 2000 ||
                    year > 2100
            ) ||
            new Set(eligibility.graduationYears).size !== eligibility.graduationYears.length
        ) {
            const error = new Error(
                "graduationYears must contain unique integers between 2000 and 2100."
            );
            error.statusCode = 400;
            throw error;
        }
    }
};


/**
 * Creates a new placement drive along with its eligibility criteria atomically.
 */
const createPlacementDrive = async (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        const error = new Error("Request payload must be a valid object.");
        error.statusCode = 400;
        throw error;
    }

    const {
        companyId,
        jobRoleId,
        title,
        packageLPA,
        driveDate,
        applicationDeadline,
        status = "UPCOMING",
        venue,
        hiringProcess,
        eligibility,
    } = payload;

    if (companyId === undefined || companyId === null || companyId === "") {
        const error = new Error("companyId is required.");
        error.statusCode = 400;
        throw error;
    }
    const parsedCompanyId = parsePositiveInteger(companyId, "companyId");

    if (jobRoleId === undefined || jobRoleId === null || jobRoleId === "") {
        const error = new Error("jobRoleId is required.");
        error.statusCode = 400;
        throw error;
    }
    const parsedJobRoleId = parsePositiveInteger(jobRoleId, "jobRoleId");

    if (typeof title !== "string" || !title.trim()) {
        const error = new Error("Drive title is required and cannot be empty.");
        error.statusCode = 400;
        throw error;
    }

    if (packageLPA === undefined || packageLPA === null || packageLPA === "") {
        const error = new Error("packageLPA is required.");
        error.statusCode = 400;
        throw error;
    }

    const parsedPackage = Number(packageLPA);
    if (!Number.isFinite(parsedPackage) || parsedPackage <= 0) {
        const error = new Error("packageLPA must be a positive number.");
        error.statusCode = 400;
        throw error;
    }

    if (venue !== undefined && venue !== null && typeof venue !== "string") {
        const error = new Error("venue must be a string or null.");
        error.statusCode = 400;
        throw error;
    }

    if (hiringProcess !== undefined && hiringProcess !== null && typeof hiringProcess !== "string") {
        const error = new Error("hiringProcess must be a string or null.");
        error.statusCode = 400;
        throw error;
    }

    // 1. Verify Company exists
    const company = await prisma.company.findUnique({
        where: { id: parsedCompanyId },
    });
    if (!company) {
        const error = new Error(`Company with ID ${parsedCompanyId} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    // 2. Verify Job Role exists
    const jobRole = await prisma.jobRole.findUnique({
        where: { id: parsedJobRoleId },
    });
    if (!jobRole) {
        const error = new Error(`Job role with ID ${parsedJobRoleId} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    // 3. Business rule: Job role must belong to the specified Company
    if (jobRole.companyId !== parsedCompanyId) {
        const error = new Error(
            `Job role "${jobRole.title}" does not belong to company "${company.name}".`
        );
        error.statusCode = 422;
        throw error;
    }

    // 4. Validate Status
    const driveStatus = String(status).toUpperCase();
    if (!VALID_DRIVE_STATUSES.includes(driveStatus)) {
        const error = new Error(
            `Invalid status "${status}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`
        );
        error.statusCode = 400;
        throw error;
    }

    // 5. Validate dates
    let parsedDriveDate = null;
    let parsedDeadline = null;

    if (driveDate) {
        parsedDriveDate = new Date(driveDate);
        if (Number.isNaN(parsedDriveDate.getTime())) {
            const error = new Error("Invalid driveDate format. Must be an ISO date string.");
            error.statusCode = 400;
            throw error;
        }
    }

    if (applicationDeadline) {
        parsedDeadline = new Date(applicationDeadline);
        if (Number.isNaN(parsedDeadline.getTime())) {
            const error = new Error(
                "Invalid applicationDeadline format. Must be an ISO date string."
            );
            error.statusCode = 400;
            throw error;
        }
    }

    if (parsedDriveDate && parsedDeadline && parsedDeadline > parsedDriveDate) {
        const error = new Error(
            "Application deadline cannot be after the scheduled drive date."
        );
        error.statusCode = 422;
        throw error;
    }

    // Validate eligibility criteria before database operations
    if (eligibility !== undefined) {
        validateEligibilityCriteria(eligibility);
    }

    // 7. Validate departments if specified
    if (eligibility && Array.isArray(eligibility.departmentIds) && eligibility.departmentIds.length > 0) {
        const existingDepartments = await prisma.department.findMany({
            where: { id: { in: eligibility.departmentIds.map((id) => Number(id)) } },
            select: { id: true },
        });

        const foundIds = new Set(existingDepartments.map((d) => d.id));
        const invalidIds = eligibility.departmentIds.filter((id) => !foundIds.has(Number(id)));

        if (invalidIds.length > 0) {
            const error = new Error(
                `Department IDs not found: ${invalidIds.join(", ")}.`
            );
            error.statusCode = 400;
            throw error;
        }
    }

    // 8. Execute transactional creation
    return await prisma.$transaction(async (tx) => {
        const createdDrive = await tx.placementDrive.create({
            data: {
                companyId: parsedCompanyId,
                jobRoleId: parsedJobRoleId,
                title: title.trim(),
                packageLPA: parsedPackage,
                driveDate: parsedDriveDate,
                applicationDeadline: parsedDeadline,
                status: driveStatus,
                venue: venue ? venue.trim() : null,
                hiringProcess: hiringProcess ? hiringProcess.trim() : null,
            },
        });

        // Create Eligibility Criteria & Junctions if provided
        if (eligibility) {
            await tx.eligibilityCriteria.create({
                data: {
                    driveId: createdDrive.id,
                    minimumCGPA: eligibility.minimumCGPA !== undefined ? Number(eligibility.minimumCGPA) : 0,
                    minimumTenth: eligibility.minimumTenth !== undefined ? Number(eligibility.minimumTenth) : 0,
                    minimumTwelfth: eligibility.minimumTwelfth !== undefined && eligibility.minimumTwelfth !== null
                        ? Number(eligibility.minimumTwelfth)
                        : null,
                    minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage !== undefined && eligibility.minimumDiplomaPercentage !== null
                        ? Number(eligibility.minimumDiplomaPercentage)
                        : null,
                    maximumBacklogs: eligibility.maximumBacklogs !== undefined ? Number(eligibility.maximumBacklogs) : 0,
                    allowPreviousPlacement: Boolean(eligibility.allowPreviousPlacement),
                },
            });

            if (Array.isArray(eligibility.departmentIds) && eligibility.departmentIds.length > 0) {
                const branchData = eligibility.departmentIds.map((deptId) => ({
                    driveId: createdDrive.id,
                    departmentId: Number(deptId),
                }));
                await tx.driveEligibleBranch.createMany({
                    data: branchData,
                    skipDuplicates: true,
                });
            }

            if (Array.isArray(eligibility.graduationYears) && eligibility.graduationYears.length > 0) {
                const yearData = eligibility.graduationYears.map((yr) => ({
                    driveId: createdDrive.id,
                    graduationYear: Number(yr),
                }));
                await tx.driveEligibleYear.createMany({
                    data: yearData,
                    skipDuplicates: true,
                });
            }
        }

        // Return newly created drive with its relations
        return await tx.placementDrive.findUnique({
            where: { id: createdDrive.id },
            include: {
                company: { select: { id: true, name: true, website: true, description: true } },
                jobRole: { select: { id: true, title: true, description: true, domain: true } },
                eligibilityCriteria: true,
                eligibleBranches: {
                    include: { department: { select: { id: true, name: true, code: true } } },
                },
                eligibleYears: {
                    select: { graduationYear: true },
                },
            },
        });
    });
};

/**
 * Lists all drives with comprehensive filtering, search, and pagination.
 */

const getAllPlacementDrives = async (query = {}) => {
    if (!query || typeof query !== "object" || Array.isArray(query)) {
        const error = new Error("Query parameters must be an object.");
        error.statusCode = 400;
        throw error;
    }

    const allowedSortFields = [
        "createdAt",
        "driveDate",
        "applicationDeadline",
        "packageLPA",
        "title",
        "status",
    ];

    const allowedStatuses = VALID_DRIVE_STATUSES;

    const invalidQuery = (message) => {
        const error = new Error(message);
        error.statusCode = 400;
        throw error;
    };

    const parsePositiveInteger = (value, field, defaultValue) => {
        if (value === undefined || value === "") {
            return defaultValue;
        }

        const number = Number(value);

        if (!Number.isSafeInteger(number) || number < 1) {
            invalidQuery(`${field} must be a positive integer.`);
        }

        return number;
    };

    const pageNum = parsePositiveInteger(query.page, "page", 1);
    const limitNum = parsePositiveInteger(query.limit, "limit", 20);

    if (limitNum > 100) {
        invalidQuery("limit cannot exceed 100.");
    }

    for (const field of ["companyId", "jobRoleId", "departmentId"]) {
        if (query[field] !== undefined && query[field] !== "") {
            const value = Number(query[field]);

            if (!Number.isSafeInteger(value) || value < 1) {
                invalidQuery(`${field} must be a positive integer.`);
            }
        }
    }

    if (query.graduationYear !== undefined && query.graduationYear !== "") {
        const year = Number(query.graduationYear);

        if (!Number.isSafeInteger(year) || year < 2000 || year > 2100) {
            invalidQuery("graduationYear must be a valid year.");
        }
    }

    if (query.status !== undefined && query.status !== "") {
        if (
            typeof query.status !== "string" ||
            !allowedStatuses.includes(query.status.toUpperCase())
        ) {
            invalidQuery("Invalid drive status.");
        }
    }

    if (
        query.sortBy !== undefined &&
        query.sortBy !== "" &&
        !allowedSortFields.includes(query.sortBy)
    ) {
        invalidQuery("Invalid sortBy field.");
    }

    if (
        query.sortOrder !== undefined &&
        query.sortOrder !== "" &&
        !["asc", "desc"].includes(String(query.sortOrder).toLowerCase())
    ) {
        invalidQuery("sortOrder must be 'asc' or 'desc'.");
    }

    if (query.search !== undefined && typeof query.search !== "string") {
        invalidQuery("search must be a string.");
    }


    const {
        page = 1,
        limit = 20,
        companyId,
        jobRoleId,
        status,
        departmentId,
        graduationYear,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
    } = query;


    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (companyId) {
        where.companyId = Number(companyId);
    }

    if (jobRoleId) {
        where.jobRoleId = Number(jobRoleId);
    }

    if (status) {
        const upperStatus = String(status).toUpperCase();
        if (VALID_DRIVE_STATUSES.includes(upperStatus)) {
            where.status = upperStatus;
        }
    }

    if (departmentId) {
        where.eligibleBranches = {
            some: { departmentId: Number(departmentId) },
        };
    }

    if (graduationYear) {
        where.eligibleYears = {
            some: { graduationYear: Number(graduationYear) },
        };
    }

    if (search && search.trim() !== "") {
        const searchTerm = search.trim();
        where.OR = [
            { title: { contains: searchTerm, mode: "insensitive" } },
            { company: { name: { contains: searchTerm, mode: "insensitive" } } },
            { jobRole: { title: { contains: searchTerm, mode: "insensitive" } } },
            { venue: { contains: searchTerm, mode: "insensitive" } },
        ];
    }

    // Allowed sort fields to avoid SQL injection

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";

    const [total, drives] = await Promise.all([
        prisma.placementDrive.count({ where }),
        prisma.placementDrive.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { [sortField]: sortDirection },
            include: {
                company: { select: { id: true, name: true, website: true, description: true } },
                jobRole: { select: { id: true, title: true, domain: true } },
                eligibilityCriteria: true,
                eligibleBranches: {
                    include: { department: { select: { id: true, name: true, code: true } } },
                },
                eligibleYears: { select: { graduationYear: true } },
                _count: {
                    select: {
                        participations: true,
                        selections: true,
                    },
                },
            },
        }),
    ]);


    const totalPages = Math.ceil(total / limitNum);

    // Transform drives for consistent, intuitive client output
    const formattedData = drives.map((d) => ({
        id: d.id,
        companyId: d.companyId,
        companyName: d.company?.name || "",
        company: d.company,
        jobRoleId: d.jobRoleId,
        jobRoleTitle: d.jobRole?.title || "",
        jobRole: d.jobRole,
        title: d.title,
        packageLPA: d.packageLPA,
        driveDate: d.driveDate,
        applicationDeadline: d.applicationDeadline,
        status: d.status,
        venue: d.venue,
        hiringProcess: d.hiringProcess,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        eligibilityCriteria: d.eligibilityCriteria,
        eligibleDepartments: d.eligibleBranches.map((b) => ({
            id: b.department.id,
            name: b.department.name,
            code: b.department.code,
        })),
        eligibleGraduationYears: d.eligibleYears.map((y) => y.graduationYear),
        participationsCount: d._count.participations,
        selectionsCount: d._count.selections,
    }));

    return {
        data: formattedData,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
        },
    };
};

/**
 * Retrieves a single drive by ID with full details.
 */
const getPlacementDriveById = async (driveId) => {
    const driveIdNum = parsePositiveInteger(driveId, "driveId");
    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        include: {
            company: { select: { id: true, name: true, website: true, description: true } },
            jobRole: { select: { id: true, title: true, description: true, domain: true } },
            eligibilityCriteria: true,
            eligibleBranches: {
                include: { department: { select: { id: true, name: true, code: true } } },
            },
            eligibleYears: { select: { graduationYear: true } },
            _count: {
                select: {
                    participations: true,
                    selections: true,
                    emailCampaigns: true,
                },
            },
        },
    });

    if (!drive) {
        return null;
    }

    return {
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
            departments: drive.eligibleBranches.map((b) => ({
                id: b.department.id,
                name: b.department.name,
                code: b.department.code,
            })),
            departmentIds: drive.eligibleBranches.map((b) => b.department.id),
            graduationYears: drive.eligibleYears.map((y) => y.graduationYear),
        },
        counts: {
            participations: drive._count.participations,
            selections: drive._count.selections,
            campaigns: drive._count.emailCampaigns,
        },
    };
};

/**
 * Updates a placement drive and its eligibility settings.
 */
const updatePlacementDrive = async (driveId, payload) => {
    const driveIdNum = parsePositiveInteger(driveId, "driveId");

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        const error = new Error("Request payload must be a valid object.");
        error.statusCode = 400;
        throw error;
    }

    const existing = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        include: { eligibilityCriteria: true },
    });

    if (!existing) {
        const error = new Error(`Placement drive with ID ${driveIdNum} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    const {
        title,
        packageLPA,
        driveDate,
        applicationDeadline,
        status,
        venue,
        hiringProcess,
        companyId,
        jobRoleId,
        eligibility,
    } = payload;

    // Validate eligibility criteria before database updates
    if (eligibility !== undefined) {
        validateEligibilityCriteria(eligibility);
    }

    const dataToUpdate = {};

    if (title !== undefined) {
        if (typeof title !== "string" || !title.trim()) {
            const error = new Error("Drive title cannot be empty.");
            error.statusCode = 400;
            throw error;
        }
        dataToUpdate.title = title.trim();
    }

    if (packageLPA !== undefined) {
        const pkg = Number(packageLPA);
        if (!Number.isFinite(pkg) || pkg <= 0) {
            const error = new Error("packageLPA must be a positive number.");
            error.statusCode = 400;
            throw error;
        }
        dataToUpdate.packageLPA = pkg;
    }

    if (venue !== undefined) {
        if (venue !== null && typeof venue !== "string") {
            const error = new Error("venue must be a string or null.");
            error.statusCode = 400;
            throw error;
        }
        dataToUpdate.venue = venue ? venue.trim() : null;
    }

    if (hiringProcess !== undefined) {
        if (hiringProcess !== null && typeof hiringProcess !== "string") {
            const error = new Error("hiringProcess must be a string or null.");
            error.statusCode = 400;
            throw error;
        }
        dataToUpdate.hiringProcess = hiringProcess ? hiringProcess.trim() : null;
    }

    if (driveDate !== undefined) {
        if (driveDate === null) {
            dataToUpdate.driveDate = null;
        } else {
            const parsed = new Date(driveDate);
            if (Number.isNaN(parsed.getTime())) {
                const error = new Error("Invalid driveDate format.");
                error.statusCode = 400;
                throw error;
            }
            dataToUpdate.driveDate = parsed;
        }
    }

    if (applicationDeadline !== undefined) {
        if (applicationDeadline === null) {
            dataToUpdate.applicationDeadline = null;
        } else {
            const parsed = new Date(applicationDeadline);
            if (Number.isNaN(parsed.getTime())) {
                const error = new Error("Invalid applicationDeadline format.");
                error.statusCode = 400;
                throw error;
            }
            dataToUpdate.applicationDeadline = parsed;
        }
    }

    // Validate deadline vs driveDate
    const finalDriveDate = dataToUpdate.driveDate !== undefined ? dataToUpdate.driveDate : existing.driveDate;
    const finalDeadline = dataToUpdate.applicationDeadline !== undefined ? dataToUpdate.applicationDeadline : existing.applicationDeadline;

    if (finalDriveDate && finalDeadline && finalDeadline > finalDriveDate) {
        const error = new Error(
            "Application deadline cannot be after the scheduled drive date."
        );
        error.statusCode = 422;
        throw error;
    }

    // Validate company and role relations if updated
    let finalCompanyId = existing.companyId;
    let finalJobRoleId = existing.jobRoleId;

    if (companyId !== undefined) {
        finalCompanyId = parsePositiveInteger(companyId, "companyId");
        const company = await prisma.company.findUnique({
            where: { id: finalCompanyId },
        });
        if (!company) {
            const error = new Error(`Company with ID ${finalCompanyId} was not found.`);
            error.statusCode = 404;
            throw error;
        }
        dataToUpdate.companyId = finalCompanyId;
    }

    if (jobRoleId !== undefined) {
        finalJobRoleId = parsePositiveInteger(jobRoleId, "jobRoleId");
        dataToUpdate.jobRoleId = finalJobRoleId;
    }

    if (companyId !== undefined || jobRoleId !== undefined) {
        const role = await prisma.jobRole.findUnique({
            where: { id: finalJobRoleId },
        });
        if (!role) {
            const error = new Error(`Job role with ID ${finalJobRoleId} not found.`);
            error.statusCode = 404;
            throw error;
        }

        if (role.companyId !== finalCompanyId) {
            const error = new Error("Selected job role does not belong to the selected company.");
            error.statusCode = 422;
            throw error;
        }
    }

    if (status !== undefined) {
        const error = new Error(
            "Use PATCH /drives/:driveId/status to update the drive status."
        );
        error.statusCode = 400;
        throw error;
    }

    return await prisma.$transaction(async (tx) => {
        const updated = await tx.placementDrive.update({
            where: { id: driveIdNum },
            data: dataToUpdate,
        });

        // If eligibility criteria is included in update payload
        if (eligibility) {

            // Verify department IDs exist before updating eligibility
            if (Array.isArray(eligibility.departmentIds)) {
                const existingDepartments = await tx.department.findMany({
                    where: {
                        id: {
                            in: eligibility.departmentIds,
                        },
                    },
                    select: {
                        id: true,
                    },
                });

                if (existingDepartments.length !== eligibility.departmentIds.length) {
                    const error = new Error("One or more department IDs do not exist.");
                    error.statusCode = 400;
                    throw error;
                }
            }

            await tx.eligibilityCriteria.upsert({
                where: { driveId: driveIdNum },
                update: {
                    minimumCGPA: eligibility.minimumCGPA !== undefined ? Number(eligibility.minimumCGPA) : undefined,
                    minimumTenth: eligibility.minimumTenth !== undefined ? Number(eligibility.minimumTenth) : undefined,
                    minimumTwelfth: eligibility.minimumTwelfth !== undefined ? (eligibility.minimumTwelfth === null ? null : Number(eligibility.minimumTwelfth)) : undefined,
                    minimumDiplomaPercentage: eligibility.minimumDiplomaPercentage !== undefined ? (eligibility.minimumDiplomaPercentage === null ? null : Number(eligibility.minimumDiplomaPercentage)) : undefined,
                    maximumBacklogs: eligibility.maximumBacklogs !== undefined ? Number(eligibility.maximumBacklogs) : undefined,
                    allowPreviousPlacement: eligibility.allowPreviousPlacement !== undefined ? Boolean(eligibility.allowPreviousPlacement) : undefined,
                },
                create: {
                    driveId: driveIdNum,
                    minimumCGPA: eligibility.minimumCGPA !== undefined ? Number(eligibility.minimumCGPA) : 0,
                    minimumTenth: eligibility.minimumTenth !== undefined ? Number(eligibility.minimumTenth) : 0,

                    minimumTwelfth:
                        eligibility.minimumTwelfth != null
                            ? Number(eligibility.minimumTwelfth)
                            : null,

                    minimumDiplomaPercentage:
                        eligibility.minimumDiplomaPercentage != null
                            ? Number(eligibility.minimumDiplomaPercentage)
                            : null,

                    maximumBacklogs: eligibility.maximumBacklogs !== undefined ? Number(eligibility.maximumBacklogs) : 0,
                    allowPreviousPlacement: Boolean(eligibility.allowPreviousPlacement),
                },
            });

            if (Array.isArray(eligibility.departmentIds)) {
                await tx.driveEligibleBranch.deleteMany({
                    where: { driveId: driveIdNum },
                });
                if (eligibility.departmentIds.length > 0) {
                    await tx.driveEligibleBranch.createMany({
                        data: eligibility.departmentIds.map((id) => ({
                            driveId: driveIdNum,
                            departmentId: Number(id),
                        })),
                        skipDuplicates: true,
                    });
                }
            }

            if (Array.isArray(eligibility.graduationYears)) {
                await tx.driveEligibleYear.deleteMany({
                    where: { driveId: driveIdNum },
                });
                if (eligibility.graduationYears.length > 0) {
                    await tx.driveEligibleYear.createMany({
                        data: eligibility.graduationYears.map((yr) => ({
                            driveId: driveIdNum,
                            graduationYear: Number(yr),
                        })),
                        skipDuplicates: true,
                    });
                }
            }
        }

        return await tx.placementDrive.findUnique({
            where: { id: updated.id },
            include: {
                company: { select: { id: true, name: true, website: true, description: true } },
                jobRole: { select: { id: true, title: true, description: true, domain: true } },
                eligibilityCriteria: true,
                eligibleBranches: {
                    include: { department: { select: { id: true, name: true, code: true } } },
                },
                eligibleYears: { select: { graduationYear: true } },
            },
        });
    });
};

/**
 * Updates drive status with lifecycle validation.
 */
const updatePlacementDriveStatus = async (driveId, newStatus) => {
    const driveIdNum = parsePositiveInteger(driveId, "driveId");

    if (newStatus === undefined || newStatus === null || typeof newStatus !== "string" || !newStatus.trim()) {
        const error = new Error("Status is required and must be a non-empty string.");
        error.statusCode = 400;
        throw error;
    }

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        select: { id: true, status: true },
    });

    if (!drive) {
        const error = new Error(`Placement drive with ID ${driveIdNum} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    const targetStatus = newStatus.trim().toUpperCase();
    if (!VALID_DRIVE_STATUSES.includes(targetStatus)) {
        const error = new Error(
            `Invalid status "${newStatus}". Allowed values: ${VALID_DRIVE_STATUSES.join(", ")}.`
        );
        error.statusCode = 400;
        throw error;
    }

    if (drive.status === targetStatus) {
        return {
            id: drive.id,
            status: drive.status,
            message: `Drive is already in ${targetStatus} status.`,
            updatedAt: new Date(),
        };
    }

    // Check transition validity
    const allowed = ALLOWED_STATUS_TRANSITIONS[drive.status] || [];
    if (!allowed.includes(targetStatus)) {
        const error = new Error(
            `Cannot transition drive status from "${drive.status}" to "${targetStatus}".`
        );
        error.statusCode = 422;
        throw error;
    }

    const result = await prisma.placementDrive.updateMany({
        where: {
            id: driveIdNum,
            status: drive.status,
        },
        data: {
            status: targetStatus,
        },
    });

    if (result.count === 0) {
        const error = new Error(
            "Drive status changed concurrently. Please refresh and try again."
        );
        error.statusCode = 409;
        throw error;
    }

    const updated = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
        select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
        },
    });

    return updated;
};

/**
 * Replaces eligibility criteria atomically for a drive.
 */
const replaceEligibilityCriteria = async (driveId, payload) => {
    const driveIdNum = parsePositiveInteger(driveId, "driveId");

    const drive = await prisma.placementDrive.findUnique({
        where: { id: driveIdNum },
    });

    if (!drive) {
        const error = new Error(`Placement drive with ID ${driveIdNum} was not found.`);
        error.statusCode = 404;
        throw error;
    }

    const error = (message) => {
        const err = new Error(message);
        err.statusCode = 400;
        throw err;
    };

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        error("Eligibility criteria payload must be an object.");
    }

    validateEligibilityCriteria(payload);

    const {
        minimumCGPA = 0,
        minimumTenth = 0,
        minimumTwelfth = null,
        minimumDiplomaPercentage = null,
        maximumBacklogs = 0,
        allowPreviousPlacement = false,
        departmentIds = [],
        graduationYears = [],
    } = payload;

    return await prisma.$transaction(async (tx) => {
        if (departmentIds.length > 0) {
            const existingDepartments = await tx.department.findMany({
                where: {
                    id: { in: departmentIds },
                },
                select: { id: true },
            });

            if (existingDepartments.length !== departmentIds.length) {
                const error = new Error("One or more department IDs do not exist.");
                error.statusCode = 400;
                throw error;
            }
        }
        const criteria = await tx.eligibilityCriteria.upsert({
            where: { driveId: driveIdNum },
            update: {
                minimumCGPA: Number(minimumCGPA),
                minimumTenth: Number(minimumTenth),
                minimumTwelfth: minimumTwelfth !== null ? Number(minimumTwelfth) : null,
                minimumDiplomaPercentage: minimumDiplomaPercentage !== null ? Number(minimumDiplomaPercentage) : null,
                maximumBacklogs: Number(maximumBacklogs),
                allowPreviousPlacement: Boolean(allowPreviousPlacement),
            },
            create: {
                driveId: driveIdNum,
                minimumCGPA: Number(minimumCGPA),
                minimumTenth: Number(minimumTenth),
                minimumTwelfth: minimumTwelfth !== null ? Number(minimumTwelfth) : null,
                minimumDiplomaPercentage: minimumDiplomaPercentage !== null ? Number(minimumDiplomaPercentage) : null,
                maximumBacklogs: Number(maximumBacklogs),
                allowPreviousPlacement: Boolean(allowPreviousPlacement),
            },
        });

        // Sync branches
        await tx.driveEligibleBranch.deleteMany({
            where: { driveId: driveIdNum },
        });

        if (Array.isArray(departmentIds) && departmentIds.length > 0) {
            await tx.driveEligibleBranch.createMany({
                data: departmentIds.map((deptId) => ({
                    driveId: driveIdNum,
                    departmentId: Number(deptId),
                })),
                skipDuplicates: true,
            });
        }

        // Sync graduation years
        await tx.driveEligibleYear.deleteMany({
            where: { driveId: driveIdNum },
        });

        if (Array.isArray(graduationYears) && graduationYears.length > 0) {
            await tx.driveEligibleYear.createMany({
                data: graduationYears.map((yr) => ({
                    driveId: driveIdNum,
                    graduationYear: Number(yr),
                })),
                skipDuplicates: true,
            });
        }

        const branches = await tx.driveEligibleBranch.findMany({
            where: { driveId: driveIdNum },
            include: { department: { select: { id: true, name: true, code: true } } },
        });

        const years = await tx.driveEligibleYear.findMany({
            where: { driveId: driveIdNum },
            select: { graduationYear: true },
        });

        return {
            driveId: driveIdNum,
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
    validateEligibilityCriteria
};
