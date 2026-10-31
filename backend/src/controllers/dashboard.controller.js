
const prisma = require("../prismaClient");

const getOverview = async (req, res, next) => {
    try {
        const [
            totalStudents,
            selections,
            upcomingDrives,
            ongoingDrives,
            departments,
        ] = await Promise.all([
            prisma.student.count(),

            prisma.studentSelection.findMany({
                where: {
                    status: {
                        in: ["SELECTED", "OFFER_ACCEPTED"],
                    },
                },
                select: {
                    studentId: true,
                    packageLPA: true,
                    student: {
                        select: {
                            departmentId: true,
                        },
                    },
                },
            }),

            prisma.placementDrive.count({
                where: { status: "UPCOMING" },
            }),

            prisma.placementDrive.count({
                where: { status: "ONGOING" },
            }),

            prisma.department.findMany({
                select: {
                    id: true,
                    name: true,
                    code: true,
                    students: {
                        select: {
                            id: true,
                            selection: {
                                select: {
                                    status: true,
                                    packageLPA: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { name: "asc" },
            }),
        ]);

        const placedStudents = selections.length;
        const unplacedStudents = totalStudents - placedStudents;

        const packages = selections.map(
            (selection) => selection.packageLPA
        );

        const totalPackage = packages.reduce(
            (sum, packageLPA) => sum + packageLPA,
            0
        );

        const departmentSummaries = departments.map((department) => {
            const students = department.students;
            const departmentPlaced = students.filter(
                (student) =>
                    student.selection &&
                    ["SELECTED", "OFFER_ACCEPTED"].includes(
                        student.selection.status
                    )
            );

            const departmentPackages = departmentPlaced.map(
                (student) => student.selection.packageLPA
            );

            return {
                departmentId: department.id,
                departmentName: department.name,
                departmentCode: department.code,
                totalStudents: students.length,
                placedStudents: departmentPlaced.length,
                unplacedStudents: students.length - departmentPlaced.length,
                placementPercentage:
                    students.length > 0
                        ? Number(
                            ((departmentPlaced.length / students.length) * 100).toFixed(2)
                        )
                        : 0,
                averagePackage:
                    departmentPackages.length > 0
                        ? Number(
                            (
                                departmentPackages.reduce((sum, value) => sum + value, 0) /
                                departmentPackages.length
                            ).toFixed(2)
                        )
                        : 0,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                totalStudents,
                placedStudents,
                unplacedStudents,
                placementPercentage:
                    totalStudents > 0
                        ? Number(((placedStudents / totalStudents) * 100).toFixed(2))
                        : 0,
                averagePackage:
                    packages.length > 0
                        ? Number((totalPackage / packages.length).toFixed(2))
                        : 0,
                highestPackage: packages.length > 0 ? Math.max(...packages) : 0,
                lowestPackage: packages.length > 0 ? Math.min(...packages) : 0,
                upcomingDrives,
                ongoingDrives,
                departmentSummaries,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getDepartmentOverview = async (req, res) => {
    try {
        const departmentId = Number(req.params.departmentId);

        if (
            !Number.isInteger(departmentId) ||
            departmentId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid department ID",
            });
        }

        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: {
                id: true,
                name: true,
                code: true,
                students: {
                    select: {
                        id: true,
                        selection: {
                            select: {
                                status: true,
                                packageLPA: true,
                            },
                        },
                    },
                },
            },
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: "Department not found",
            });
        }

        const totalStudents = department.students.length;

        // SELECTED and OFFER_ACCEPTED count as placed.
        // OFFER_DECLINED does not.
        const placedSelections = department.students
            .map((student) => student.selection)
            .filter(
                (selection) =>
                    selection &&
                    ["SELECTED", "OFFER_ACCEPTED"].includes(selection.status)
            );

        const placedStudents = placedSelections.length;
        const unplacedStudents = totalStudents - placedStudents;

        const packages = placedSelections.map(
            (selection) => selection.packageLPA
        );

        const averagePackage = packages.length
            ? packages.reduce((sum, value) => sum + value, 0) /
            packages.length
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                department: {
                    id: department.id,
                    name: department.name,
                    code: department.code,
                },
                totalStudents,
                placedStudents,
                unplacedStudents,
                placementPercentage:
                    totalStudents > 0
                        ? Number(
                            ((placedStudents / totalStudents) * 100).toFixed(2)
                        )
                        : 0,
                averagePackage: Number(averagePackage.toFixed(2)),
                highestPackage: packages.length ? Math.max(...packages) : 0,
                lowestPackage: packages.length ? Math.min(...packages) : 0,
            },
        });
    } catch (error) {
        console.error("Department dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch department dashboard",
        });
    }
};

module.exports = {
    getOverview,
    getDepartmentOverview
};
