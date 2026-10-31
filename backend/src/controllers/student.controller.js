const prisma = require("../prismaClient");
const bcrypt = require("bcrypt");
const { Prisma } = require("@prisma/client");

const PATHWAYS = ["HSC", "DIPLOMA"];

const isValidText = (value) =>
    typeof value === "string" && value.trim().length > 0;

const isValidPercentage = (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100;

const validateAcademicFields = (body) => {
    const errors = [];

    if (
        body.CGPA !== undefined &&
        body.CGPA !== null &&
        (
            typeof body.CGPA !== "number" ||
            !Number.isFinite(body.CGPA) ||
            body.CGPA < 0 ||
            body.CGPA > 10
        )
    ) {
        errors.push("CGPA must be between 0 and 10");
    }

    for (const field of [
        "tenthPercentage",
        "twelfthPercentage",
        "diplomaPercentage",
    ]) {
        if (
            body[field] !== undefined &&
            body[field] !== null &&
            !isValidPercentage(body[field])
        ) {
            errors.push(`${field} must be between 0 and 100`);
        }
    }

    if (
        body.activeBacklogs !== undefined &&
        (
            !Number.isInteger(body.activeBacklogs) ||
            body.activeBacklogs < 0
        )
    ) {
        errors.push("activeBacklogs must be a non-negative integer");
    }

    if (
        body.graduationYear !== undefined &&
        (
            !Number.isInteger(body.graduationYear) ||
            body.graduationYear < 2000
        )
    ) {
        errors.push("Invalid graduationYear");
    }

    if (
        body.academicPathway !== undefined &&
        !PATHWAYS.includes(body.academicPathway)
    ) {
        errors.push("academicPathway must be HSC or DIPLOMA");
    }

    return errors;
};

// POST /api/v1/students
// TPO: Create a student and linked login account.
const createStudent = async (req, res) => {
    try {
        const {
            name,
            email,
            PRN,
            departmentId,
            graduationYear,
            academicPathway,
            CGPA,
            tenthPercentage,
            twelfthPercentage,
            diplomaPercentage,
            activeBacklogs,
        } = req.body;

        if (
            !isValidText(name) ||
            !isValidText(email) ||
            !isValidText(PRN)
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and PRN are required",
            });
        }



        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPRN = PRN.trim();
        const normalizedName = name.trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address",
            });
        }

        if (
            !Number.isInteger(departmentId) ||
            departmentId <= 0 ||
            !Number.isInteger(graduationYear) ||
            graduationYear < 2000 ||
            !PATHWAYS.includes(academicPathway)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid department, graduation year or pathway",
            });
        }

        const errors = validateAcademicFields(req.body);

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        // HSC students require 12th marks; Diploma students require
        // diploma marks. Irrelevant pathway marks are stored as null.
        if (
            academicPathway === "HSC" &&
            !isValidPercentage(twelfthPercentage)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid twelfthPercentage is required for HSC",
            });
        }

        if (
            academicPathway === "DIPLOMA" &&
            !isValidPercentage(diplomaPercentage)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid diplomaPercentage is required for DIPLOMA",
            });
        }

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true },
        });

        if (!department) {
            return res.status(400).json({
                success: false,
                message: "Department not found",
            });
        }

        const passwordHash = await bcrypt.hash(PRN.trim(), 12);

        const student = await prisma.$transaction(async (tx) => {
            return tx.student.create({
                data: {
                    PRN: normalizedPRN,
                    departmentId,
                    graduationYear,
                    academicPathway,
                    CGPA: CGPA ?? null,
                    tenthPercentage: tenthPercentage ?? null,
                    twelfthPercentage:
                        academicPathway === "HSC"
                            ? twelfthPercentage
                            : null,
                    diplomaPercentage:
                        academicPathway === "DIPLOMA"
                            ? diplomaPercentage
                            : null,
                    activeBacklogs: activeBacklogs ?? 0,

                    user: {
                        create: {
                            name: normalizedName,
                            email: normalizedEmail,
                            passwordHash,
                            role: "STUDENT",
                            mustChangePassword: true
                        },
                    },
                },
                select: {
                    id: true,
                    PRN: true,
                    departmentId: true,
                    graduationYear: true,
                    academicPathway: true,
                    CGPA: true,
                    tenthPercentage: true,
                    twelfthPercentage: true,
                    diplomaPercentage: true,
                    activeBacklogs: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            mustChangePassword: true
                        },
                    },
                },
            });
        });

        return res.status(201).json({
            success: true,
            message: "Student created successfully",
            data: student,
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Email or PRN already exists",
            });
        }

        console.error("Create student error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create student",
        });
    }
};




const getStudents = async (req, res) => {
    try {
        const {
            page: rawPage = "1",
            limit: rawLimit = "20",
            search,
            departmentId,
            graduationYear,
            minCGPA,
            maxBacklogs,
            sortOrder = "asc",
        } = req.query;

        // Strict pagination validation
        const isPositiveInteger = (value) =>
            /^\d+$/.test(String(value)) && Number(value) >= 1;

        if (
            !isPositiveInteger(rawPage) ||
            !isPositiveInteger(rawLimit) ||
            Number(rawLimit) > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid pagination. Page must be positive and limit must be between 1 and 100.",
            });
        }

        const page = Number(rawPage);
        const limit = Number(rawLimit);

        if (!["asc", "desc"].includes(sortOrder)) {
            return res.status(400).json({
                success: false,
                message: "sortOrder must be asc or desc",
            });
        }

        const where = {};

        // Search by PRN, name, or email
        if (search !== undefined) {
            if (typeof search !== "string" || search.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: "Search must be a string of at most 100 characters.",
                });
            }

            const term = search.trim();

            if (term) {
                where.OR = [
                    {
                        PRN: {
                            contains: term,
                            mode: "insensitive",
                        },
                    },
                    {
                        user: {
                            is: {
                                name: {
                                    contains: term,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        user: {
                            is: {
                                email: {
                                    contains: term,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                ];
            }
        }

        // Validate optional numeric filters
        const parseIntegerFilter = (value, field, min) => {
            if (value === undefined) return null;

            if (
                typeof value !== "string" ||
                !/^\d+$/.test(value) ||
                Number(value) < min ||
                !Number.isSafeInteger(Number(value))
            ) {
                throw new Error(`INVALID_FILTER:${field}`);
            }

            return Number(value);
        };

        const parseNumberFilter = (value, field, min, max) => {
            if (value === undefined) return null;

            if (
                typeof value !== "string" ||
                value.trim() === "" ||
                !Number.isFinite(Number(value)) ||
                Number(value) < min ||
                Number(value) > max
            ) {
                throw new Error(`INVALID_FILTER:${field}`);
            }

            return Number(value);
        };

        let parsedDepartmentId;
        let parsedGraduationYear;
        let parsedMinCGPA;
        let parsedMaxBacklogs;

        try {
            parsedDepartmentId = parseIntegerFilter(
                departmentId,
                "departmentId",
                1
            );

            parsedGraduationYear = parseIntegerFilter(
                graduationYear,
                "graduationYear",
                2000
            );

            parsedMinCGPA = parseNumberFilter(
                minCGPA,
                "minCGPA",
                0,
                10
            );

            parsedMaxBacklogs = parseIntegerFilter(
                maxBacklogs,
                "maxBacklogs",
                0
            );
        } catch (error) {
            if (error.message.startsWith("INVALID_FILTER:")) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid ${error.message.split(":")[1]}`,
                });
            }

            throw error;
        }

        if (parsedDepartmentId !== null) {
            where.departmentId = parsedDepartmentId;
        }

        if (parsedGraduationYear !== null) {
            where.graduationYear = parsedGraduationYear;
        }

        if (parsedMinCGPA !== null) {
            where.CGPA = { gte: parsedMinCGPA };
        }

        if (parsedMaxBacklogs !== null) {
            // Inclusive: students with exactly this many backlogs are included.
            where.activeBacklogs = { lte: parsedMaxBacklogs };
        }

        const [total, students] = await Promise.all([
            prisma.student.count({ where }),

            prisma.student.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [
                    { user: { name: sortOrder } },
                    { id: "asc" },
                ],
                select: {
                    id: true,
                    PRN: true,
                    graduationYear: true,
                    academicPathway: true,
                    CGPA: true,
                    tenthPercentage: true,
                    twelfthPercentage: true,
                    diplomaPercentage: true,
                    activeBacklogs: true,
                    user: {
                        select: {
                            name: true,
                            email: true,
                        },
                    },
                    department: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                        },
                    },
                    // Keep this only if selection is a single optional relation.
                    selection: {
                        select: {
                            status: true,
                        },
                    },
                },
            }),
        ]);

        const data = students.map((student) => {
            const { user, selection, ...details } = student;

            return {
                ...details,
                name: user.name,
                email: user.email,
                placementStatus: selection
                    ? selection.status
                    : "NOT_SELECTED",
            };
        });

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get students error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch students",
        });
    }
};


// PATCH /api/v1/students/:studentId
// TPO: Update account and academic fields.
const updateStudent = async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID",
            });
        }

        const allowedFields = [
            "name",
            "email",
            "PRN",
            "departmentId",
            "graduationYear",
            "academicPathway",
            "CGPA",
            "tenthPercentage",
            "twelfthPercentage",
            "diplomaPercentage",
            "activeBacklogs",
        ];

        const unknownFields = Object.keys(req.body).filter(
            (field) => !allowedFields.includes(field)
        );

        if (unknownFields.length) {
            return res.status(400).json({
                success: false,
                message: "Unsupported fields",
                errors: unknownFields,
            });
        }

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one field to update",
            });
        }

        const errors = validateAcademicFields(req.body);

        if (errors.length) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        const existing = await prisma.student.findUnique({
            where: { id: studentId },
            include: { user: true },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        const body = req.body;
        const pathway = body.academicPathway ?? existing.academicPathway;
        const nextTwelfth =
            body.twelfthPercentage !== undefined
                ? body.twelfthPercentage
                : existing.twelfthPercentage;
        const nextDiploma =
            body.diplomaPercentage !== undefined
                ? body.diplomaPercentage
                : existing.diplomaPercentage;

        if (
            pathway === "HSC" &&
            !isValidPercentage(nextTwelfth)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid twelfthPercentage is required for HSC",
            });
        }

        if (
            pathway === "DIPLOMA" &&
            !isValidPercentage(nextDiploma)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid diplomaPercentage is required for DIPLOMA",
            });
        }

        if (
            body.name !== undefined &&
            !isValidText(body.name)
        ) {
            return res.status(400).json({
                success: false,
                message: "Name cannot be empty",
            });
        }

        if (body.email !== undefined) {
            if (
                !isValidText(body.email) ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    body.email.trim()
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid email address",
                });
            }
        }

        if (
            body.PRN !== undefined &&
            !isValidText(body.PRN)
        ) {
            return res.status(400).json({
                success: false,
                message: "PRN cannot be empty",
            });
        }

        const nextDepartmentId =
            body.departmentId ?? existing.departmentId;

        if (
            body.departmentId !== undefined &&
            (
                !Number.isInteger(body.departmentId) ||
                body.departmentId <= 0
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid departmentId",
            });
        }

        if (body.departmentId !== undefined) {
            const department = await prisma.department.findUnique({
                where: { id: nextDepartmentId },
                select: { id: true },
            });

            if (!department) {
                return res.status(400).json({
                    success: false,
                    message: "Department not found",
                });
            }
        }

        const studentFields = [
            "PRN",
            "departmentId",
            "graduationYear",
            "academicPathway",
            "CGPA",
            "tenthPercentage",
            "twelfthPercentage",
            "diplomaPercentage",
            "activeBacklogs",
        ];

        const studentData = {};

        for (const field of studentFields) {
            if (body[field] !== undefined) {
                studentData[field] = body[field];
            }
        }

        if (body.PRN !== undefined) {
            studentData.PRN = body.PRN.trim();
        }

        studentData.academicPathway = pathway;

        // Keep pathway-specific marks consistent.
        if (pathway === "HSC") {
            studentData.diplomaPercentage = null;
        } else {
            studentData.twelfthPercentage = null;
        }

        const userData = {};

        if (body.name !== undefined) {
            userData.name = body.name.trim();
        }

        if (body.email !== undefined) {
            userData.email = body.email.trim().toLowerCase();
        }

        const prnChanged =
            body.PRN !== undefined &&
            body.PRN.trim() !== existing.PRN;

        // Reset the password only if the student still uses
        // their initial PRN-based password.
        if (prnChanged && existing.user.mustChangePassword) {
            userData.passwordHash = await bcrypt.hash(
                body.PRN.trim(),
                12
            );

            userData.mustChangePassword = true;
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: existing.userId },
                data: userData,
            });

            return tx.student.update({
                where: { id: studentId },
                data: studentData,
                select: {
                    id: true,
                    PRN: true,
                    departmentId: true,
                    graduationYear: true,
                    academicPathway: true,
                    CGPA: true,
                    tenthPercentage: true,
                    twelfthPercentage: true,
                    diplomaPercentage: true,
                    activeBacklogs: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
        });

        return res.status(200).json({
            success: true,
            message: "Student updated successfully",
            data: updated,
        });
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({
                success: false,
                message: "Email or PRN already exists",
            });
        }

        console.error("Update student error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update student",
        });
    }
};


const updateStudentAccountStatus = async (req, res) => {
    try {
        const studentId = Number(req.params.id);
        const { isActive } = req.body;

        if (!Number.isSafeInteger(studentId) || studentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID",
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be a boolean",
            });
        }

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                PRN: true,
                userId: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                        isActive: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        if (student.user.isActive === isActive) {
            return res.status(200).json({
                success: true,
                message: isActive
                    ? "Student account is already active"
                    : "Student account is already deactivated",
                data: {
                    studentId: student.id,
                    PRN: student.PRN,
                    isActive,
                },
            });
        }

        await prisma.user.update({
            where: { id: student.userId },
            data: { isActive },
        });

        return res.status(200).json({
            success: true,
            message: isActive
                ? "Student account reactivated successfully"
                : "Student account deactivated successfully",
            data: {
                studentId: student.id,
                PRN: student.PRN,
                name: student.user.name,
                email: student.user.email,
                isActive,
            },
        });
    } catch (error) {
        console.error("Update student account status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update student account status",
        });
    }
};



// GET /api/v1/students/:studentId
// TPO: View one student's academic details.
const getStudentById = async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID",
            });
        }

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                PRN: true,
                graduationYear: true,
                academicPathway: true,
                CGPA: true,
                tenthPercentage: true,
                twelfthPercentage: true,
                diplomaPercentage: true,
                activeBacklogs: true,
                createdAt: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                selection: {
                    select: {
                        id: true,
                        driveId: true,
                        status: true,
                        packageLPA: true,
                        selectedAt: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
            });
        }

        const { user, ...details } = student;

        return res.status(200).json({
            success: true,
            data: {
                ...details,
                name: user.name,
                email: user.email,
                placementStatus: student.selection
                    ? student.selection.status
                    : "NOT_SELECTED",
            },
        });
    } catch (error) {
        console.error("Get student by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch student details",
        });
    }
};


// GET /api/v1/students/me
// STUDENT: View only their own profile.
const getMyProfile = async (req, res) => {
    try {
        // Assumes auth middleware sets req.user.id to the authenticated User ID.
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const student = await prisma.student.findUnique({
            where: { userId },
            select: {
                id: true,
                PRN: true,
                graduationYear: true,
                academicPathway: true,
                CGPA: true,
                tenthPercentage: true,
                twelfthPercentage: true,
                diplomaPercentage: true,
                activeBacklogs: true,
                user: {
                    select: {
                        name: true,
                        email: true,
                        mustChangePassword: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                selection: {
                    select: {
                        id: true,
                        driveId: true,
                        status: true,
                        packageLPA: true,
                        selectedAt: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student profile not found",
            });
        }

        const { user, ...details } = student;

        return res.status(200).json({
            success: true,
            data: {
                ...details,
                name: user.name,
                email: user.email,
                placementStatus: student.selection
                    ? student.selection.status
                    : "NOT_SELECTED",
            },
        });
    } catch (error) {
        console.error("Get my profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch your profile",
        });
    }
};


const getMyDrives = async (req, res) => {
    try {
        // Assumes auth middleware sets req.user.id to User.id.
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const student = await prisma.student.findUnique({
            where: { userId },
            select: {
                id: true,
                departmentId: true,
                graduationYear: true,
                academicPathway: true,
                CGPA: true,
                tenthPercentage: true,
                twelfthPercentage: true,
                diplomaPercentage: true,
                activeBacklogs: true,
                selection: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student profile not found",
            });
        }

        const now = new Date();

        const drives = await prisma.placementDrive.findMany({
            where: {
                status: { in: ["UPCOMING", "ONGOING"] },
                company: { isActive: true },
                OR: [
                    { applicationDeadline: null },
                    { applicationDeadline: { gte: now } },
                ],
            },
            orderBy: { driveDate: "asc" },
            select: {
                id: true,
                title: true,
                packageLPA: true,
                driveDate: true,
                applicationDeadline: true,
                status: true,
                venue: true,
                hiringProcess: true,

                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },

                jobRole: {
                    select: {
                        id: true,
                        title: true,
                        domain: true,
                    },
                },

                eligibilityCriteria: true,

                eligibleBranches: {
                    select: { departmentId: true },
                },

                eligibleYears: {
                    select: { graduationYear: true },
                },

                participations: {
                    where: { studentId: student.id },
                    select: { processStatus: true },
                    take: 1,
                },
            },
        });

        const data = drives.map((drive) => {
            const reasons = [];
            const criteria = drive.eligibilityCriteria;

            // Missing criteria should not silently make a student eligible.
            if (!criteria) {
                reasons.push("Eligibility criteria are not configured");
            } else {
                if (
                    student.CGPA === null ||
                    student.CGPA < criteria.minimumCGPA
                ) {
                    reasons.push(
                        `Minimum CGPA required: ${criteria.minimumCGPA}`
                    );
                }

                if (
                    student.tenthPercentage === null ||
                    student.tenthPercentage < criteria.minimumTenth
                ) {
                    reasons.push(
                        `Minimum 10th percentage required: ${criteria.minimumTenth}`
                    );
                }

                if (student.academicPathway === "HSC") {
                    if (
                        criteria.minimumTwelfth !== null &&
                        (
                            student.twelfthPercentage === null ||
                            student.twelfthPercentage < criteria.minimumTwelfth
                        )
                    ) {
                        reasons.push(
                            `Minimum 12th percentage required: ${criteria.minimumTwelfth}`
                        );
                    }
                }

                if (student.academicPathway === "DIPLOMA") {
                    if (
                        criteria.minimumDiplomaPercentage !== null &&
                        (
                            student.diplomaPercentage === null ||
                            student.diplomaPercentage <
                            criteria.minimumDiplomaPercentage
                        )
                    ) {
                        reasons.push(
                            `Minimum diploma percentage required: ${criteria.minimumDiplomaPercentage}`
                        );
                    }
                }

                if (student.activeBacklogs > criteria.maximumBacklogs) {
                    reasons.push(
                        `Maximum active backlogs allowed: ${criteria.maximumBacklogs}`
                    );
                }

                const hasPreviousPlacement =
                    student.selection !== null &&
                    ["SELECTED", "OFFER_ACCEPTED"].includes(
                        student.selection.status
                    );

                if (
                    hasPreviousPlacement &&
                    !criteria.allowPreviousPlacement
                ) {
                    reasons.push("Previous placement is not allowed");
                }
            }

            // Empty branch/year lists mean no restriction.
            if (
                drive.eligibleBranches.length > 0 &&
                !drive.eligibleBranches.some(
                    (branch) => branch.departmentId === student.departmentId
                )
            ) {
                reasons.push("Your department is not eligible");
            }

            if (
                drive.eligibleYears.length > 0 &&
                !drive.eligibleYears.some(
                    (year) => year.graduationYear === student.graduationYear
                )
            ) {
                reasons.push("Your graduation year is not eligible");
            }

            const participation = drive.participations[0] ?? null;

            return {
                driveId: drive.id,
                title: drive.title,
                company: drive.company,
                jobRole: drive.jobRole,
                packageLPA: drive.packageLPA,
                driveDate: drive.driveDate,
                applicationDeadline: drive.applicationDeadline,
                status: drive.status,
                venue: drive.venue,
                hiringProcess: drive.hiringProcess,

                eligibility: {
                    isEligible: reasons.length === 0,
                    reasons,
                },

                application: participation
                    ? { status: participation.processStatus }
                    : null,
            };
        });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Get student drives error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch placement drives",
        });
    }
};



const getMyPlacements = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const student = await prisma.student.findUnique({
            where: { userId },
            select: { id: true },
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student profile not found",
            });
        }

        const selection = await prisma.studentSelection.findUnique({
            where: { studentId: student.id },
            include: {
                drive: {
                    include: {
                        company: {
                            select: {
                                name: true,
                                website: true,
                            },
                        },
                        jobRole: {
                            select: {
                                title: true,
                                domain: true,
                            },
                        },
                    },
                },
            },
        });

        if (!selection) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No official placement record found",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                selectionId: selection.id,
                status: selection.status,
                packageLPA: selection.packageLPA,
                selectedAt: selection.selectedAt,
                company: selection.drive.company,
                jobRole: selection.drive.jobRole,
                drive: {
                    id: selection.drive.id,
                    title: selection.drive.title,
                    driveDate: selection.drive.driveDate,
                },
            },
        });
    } catch (error) {
        console.error("Get my placements error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch placement details",
        });
    }
};



module.exports = {
    getStudents,
    getStudentById,
    getMyProfile,
    getMyDrives,
    getMyPlacements,
    updateStudent,
    updateStudentAccountStatus,
    createStudent
};
