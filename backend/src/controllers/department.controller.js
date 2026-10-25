
const prisma = require("../prismaClient");

// GET /api/v1/departments
// List departments with student counts and pagination
const getDepartments = async (req, res) => {
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
                message: "page must be >= 1 and limit must be between 1 and 100.",
            });
        }

        const skip = (page - 1) * limit;

        const [departments, total] = await Promise.all([
            prisma.department.findMany({
                skip,
                take: limit,
                orderBy: { name: "asc" },
                include: {
                    _count: {
                        select: { students: true },
                    },
                },
            }),
            prisma.department.count(),
        ]);

        return res.status(200).json({
            data: departments.map((department) => ({
                id: department.id,
                name: department.name,
                code: department.code,
                studentCount: department._count.students,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("getDepartments error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch departments.",
        });
    }
};

// GET /api/v1/departments/:departmentId
// Get one department with its student count
const getDepartmentById = async (req, res) => {
    try {
        const departmentId = Number(req.params.departmentId);

        if (!Number.isInteger(departmentId) || departmentId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid department ID.",
            });
        }

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            include: {
                _count: {
                    select: { students: true },
                },
            },
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found.",
            });
        }

        return res.status(200).json({
            data: {
                id: department.id,
                name: department.name,
                code: department.code,
                studentCount: department._count.students,
            },
        });
    } catch (error) {
        console.error("getDepartmentById error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch department.",
        });
    }
};

// GET /api/v1/departments/:departmentId/students
// TPO-only paginated student list for a department
const getDepartmentStudents = async (req, res) => {
    try {
        const departmentId = Number(req.params.departmentId);

        if (!Number.isInteger(departmentId) || departmentId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid department ID.",
            });
        }

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
                message: "page must be >= 1 and limit must be between 1 and 100.",
            });
        }

        const { search, graduationYear, sortBy = "name", sortOrder = "asc" } =
            req.query;

        const allowedSortFields = {
            name: "user",
            PRN: "PRN",
            CGPA: "CGPA",
            graduationYear: "graduationYear",
        };

        if (!allowedSortFields[sortBy] || !["asc", "desc"].includes(sortOrder)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sortBy or sortOrder.",
            });
        }

        let parsedGraduationYear;

        if (graduationYear !== undefined) {
            parsedGraduationYear = Number(graduationYear);

            if (
                !Number.isInteger(parsedGraduationYear) ||
                parsedGraduationYear < 2000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid graduationYear.",
                });
            }
        }

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true },
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found.",
            });
        }

        const where = {
            departmentId,
            ...(parsedGraduationYear !== undefined
                ? { graduationYear: parsedGraduationYear }
                : {}),
            ...(search
                ? {
                    OR: [
                        { PRN: { contains: String(search), mode: "insensitive" } },
                        { user: { name: { contains: String(search), mode: "insensitive" } } },
                        { user: { email: { contains: String(search), mode: "insensitive" } } },
                    ],
                }
                : {}),
        };

        const orderBy =
            sortBy === "name"
                ? { user: { name: sortOrder } }
                : { [allowedSortFields[sortBy]]: sortOrder };

        const skip = (page - 1) * limit;

        const [students, total] = await Promise.all([
            prisma.student.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                select: {
                    id: true,
                    PRN: true,
                    graduationYear: true,
                    CGPA: true,
                    activeBacklogs: true,
                    user: {
                        select: { name: true, email: true },
                    },
                    selection: {
                        select: { status: true },
                    },
                },
            }),
            prisma.student.count({ where }),
        ]);

        return res.status(200).json({
            data: students.map((student) => ({
                id: student.id,
                PRN: student.PRN,
                name: student.user.name,
                email: student.user.email,
                CGPA: student.CGPA,
                activeBacklogs: student.activeBacklogs,
                graduationYear: student.graduationYear,
                placementStatus: student.selection
                    ? student.selection.status
                    : "NOT_SELECTED",
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("getDepartmentStudents error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch department students.",
        });
    }
};

module.exports = {
    getDepartments,
    getDepartmentById,
    getDepartmentStudents,
};
