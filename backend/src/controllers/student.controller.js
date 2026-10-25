
const prisma = require("../prismaClient");

// GET /api/v1/students
// TPO: List, search, filter, and paginate students.
const getStudents = async (req, res) => {
    try {
        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 20);

        if (
            !Number.isInteger(page) ||
            !Number.isInteger(limit) ||
            page < 1 ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pagination. Page must be positive and limit must be between 1 and 100.",
            });
        }

        const {
            search,
            departmentId,
            graduationYear,
            minCGPA,
            maxBacklogs,
            sortOrder = "asc",
        } = req.query;

        if (!["asc", "desc"].includes(sortOrder)) {
            return res.status(400).json({
                success: false,
                message: "sortOrder must be asc or desc",
            });
        }

        const where = {};

        if (search && search.trim()) {
            const term = search.trim();

            where.OR = [
                { PRN: { contains: term, mode: "insensitive" } },
                {
                    user: {
                        is: {
                            name: { contains: term, mode: "insensitive" },
                        },
                    },
                },
                {
                    user: {
                        is: {
                            email: { contains: term, mode: "insensitive" },
                        },
                    },
                },
            ];
        }

        if (departmentId !== undefined) {
            const value = Number(departmentId);

            if (!Number.isInteger(value) || value <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid departmentId",
                });
            }

            where.departmentId = value;
        }

        if (graduationYear !== undefined) {
            const value = Number(graduationYear);

            if (!Number.isInteger(value) || value < 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid graduationYear",
                });
            }

            where.graduationYear = value;
        }

        if (minCGPA !== undefined) {
            const value = Number(minCGPA);

            if (!Number.isFinite(value) || value < 0 || value > 10) {
                return res.status(400).json({
                    success: false,
                    message: "minCGPA must be between 0 and 10",
                });
            }

            where.CGPA = { gte: value };
        }

        if (maxBacklogs !== undefined) {
            const value = Number(maxBacklogs);

            if (!Number.isInteger(value) || value < 0) {
                return res.status(400).json({
                    success: false,
                    message: "maxBacklogs must be a non-negative integer",
                });
            }

            where.activeBacklogs = { lte: value };
        }

        const [total, students] = await Promise.all([
            prisma.student.count({ where }),
            prisma.student.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: {
                    user: { name: sortOrder },
                },
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
    getMyPlacements
};
