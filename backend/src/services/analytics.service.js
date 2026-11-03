
const prisma = require("../prismaClient");
const ValidationError = require("../utils/ValidationError");

const PLACED_STATUSES = ["SELECTED", "OFFER_ACCEPTED"];

/**
 * Converts YYYY-YY into its starting year, ending year,
 * and July-to-June date range.
 *
 * Example: 2026-27
 * graduationYear = 2027
 * date range = 1 July 2026 to 1 July 2027 (exclusive)
 */
const parseAcademicYear = (academicYear) => {
  if (academicYear === undefined) {
    return null;
  }

  if (typeof academicYear !== "string") {
    throw new ValidationError(
      "academicYear must be a string in YYYY-YY format."
    );
  }

  const match = academicYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new ValidationError(
      "Invalid academicYear. Use YYYY-YY format, e.g. 2026-27."
    );
  }

  const startYear = Number(match[1]);
  const endYear = startYear + 1;
  const expectedEnd = String(endYear).slice(-2);

  if (match[2] !== expectedEnd) {
    throw new ValidationError(
      "Invalid academic year range. The ending year must be one year after the starting year."
    );
  }

  return {
    academicYear,
    graduationYear: endYear,
    startDate: new Date(Date.UTC(startYear, 6, 1)),
    endDate: new Date(Date.UTC(endYear, 6, 1)),
  };
};

/**
 * Rounds a number to two decimal places.
 * Returns zero when the value is null or undefined.
 */
const roundToTwo = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toFixed(2));
};


//Returns overall placement statistics.
const getOverviewAnalytics = async (academicYear) => {
  const year = parseAcademicYear(academicYear);

  // Filter students by graduation year when an academic year is provided.
  const studentWhere = year
    ? { graduationYear: year.graduationYear }
    : {};

  // Only successful placement statuses count as placed.
  const selectionWhere = {
    status: {
      in: PLACED_STATUSES,
    },
    ...(year
      ? {
          student: {
            graduationYear: year.graduationYear,
          },
        }
      : {}),
  };

  // Filter drives using their actual driveDate.
  const driveWhere = year
    ? {
        driveDate: {
          gte: year.startDate,
          lt: year.endDate,
        },
      }
    : {};

  const [
    totalStudents,
    placedStudents,
    totalDrives,
    totalCompanies,
    packageStats,
  ] = await Promise.all([
    // 1. Total students
    prisma.student.count({
      where: studentWhere,
    }),

    // 2. Unique placed students
    prisma.studentSelection.count({
      where: selectionWhere,
    }),

    // 3. Total placement drives
    prisma.placementDrive.count({
      where: driveWhere,
    }),

    // 4. Companies that conducted placement drives
    prisma.company.count({
      where: {
        placementDrives: {
          some: driveWhere,
        },
      },
    }),

    // 5. Package statistics for successful offers
    prisma.studentSelection.aggregate({
      where: selectionWhere,
      _avg: {
        packageLPA: true,
      },
      _max: {
        packageLPA: true,
      },
      _min: {
        packageLPA: true,
      },
    }),
  ]);

  const notPlacedStudents = Math.max(
    totalStudents - placedStudents,
    0
  );

  const placementPercentage =
    totalStudents === 0
      ? 0
      : (placedStudents / totalStudents) * 100;

  return {
    academicYear: year ? year.academicYear : "ALL",
    totalStudents,
    placedStudents,
    notPlacedStudents,
    placementPercentage: roundToTwo(placementPercentage),
    totalCompanies,
    totalDrives,
    averagePackageLPA: roundToTwo(packageStats._avg.packageLPA),
    highestPackageLPA: roundToTwo(packageStats._max.packageLPA),
    lowestPackageLPA: roundToTwo(packageStats._min.packageLPA),
  };
};


const getMonthlyAnalytics = async ({
    academicYear,
    year,
    departmentId,
    companyId
}) => {
    // 1. Determine the 12-month reporting period.
    // Academic year: July to June.
    // Calendar year: January to December.
    let startYear;
    let startMonth;

    if (year) {
        startYear = year;
        startMonth = 0;
    } else if (academicYear) {
        startYear = Number(academicYear.slice(0, 4));
        startMonth = 6;
    } else {
        // Default to the current academic year.
        const currentDate = new Date();
        const currentYear = currentDate.getUTCFullYear();

        if (currentDate.getUTCMonth() >= 6) {
            startYear = currentYear;
        } else {
            startYear = currentYear - 1;
        }

        startMonth = 6;
    }

    const startDate = new Date(
        Date.UTC(startYear, startMonth, 1)
    );

    const endDate = new Date(
        Date.UTC(startYear, startMonth + 12, 1)
    );

    // 2. Verify department and company IDs exist.
    if (departmentId !== undefined) {
        const department = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true }
        });

        if (!department) {
            const error = new Error("Department not found.");
            error.statusCode = 400;
            throw error;
        }
    }

    if (companyId !== undefined) {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true }
        });

        if (!company) {
            const error = new Error("Company not found.");
            error.statusCode = 400;
            throw error;
        }
    }

    // 3. Build PlacementDrive filters.
    const driveWhere = {
        driveDate: {
            gte: startDate,
            lt: endDate
        },

        ...(companyId !== undefined && {
            companyId
        }),

        // A drive must be eligible for the selected department.
        ...(departmentId !== undefined && {
            eligibleBranches: {
                some: {
                    departmentId
                }
            }
        })
    };

    // 4. Build StudentSelection filters.
    const selectionWhere = {
        selectedAt: {
            gte: startDate,
            lt: endDate
        },

        // Declined offers are not successful placements.
        status: {
            in: ["SELECTED", "OFFER_ACCEPTED"]
        },

        ...(departmentId !== undefined && {
            student: {
                is: {
                    departmentId
                }
            }
        }),

        ...(companyId !== undefined && {
            drive: {
                is: {
                    companyId
                }
            }
        })
    };

    // 5. Fetch actual drive and selection records.
    const [drives, selections] = await Promise.all([
        prisma.placementDrive.findMany({
            where: driveWhere,
            select: {
                driveDate: true
            }
        }),

        prisma.studentSelection.findMany({
            where: selectionWhere,
            select: {
                selectedAt: true,
                status: true,
                packageLPA: true
            }
        })
    ]);

    // 6. Prepare 12 monthly buckets.
    const monthlyData = [];

    const monthlyMap = new Map();

    for (let i = 0; i < 12; i++) {
        const monthDate = new Date(
            Date.UTC(startYear, startMonth + i, 1)
        );

        const month = monthDate.toLocaleString("en-US", {
            month: "long",
            timeZone: "UTC"
        });

        const monthKey =
            `${monthDate.getUTCFullYear()}-` +
            `${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;

        const record = {
            month,
            totalDrives: 0,
            studentsSelected: 0,
            offersAccepted: 0,
            averagePackageLPA: 0,
            packageTotal: 0,
            packageCount: 0
        };

        monthlyData.push(record);
        monthlyMap.set(monthKey, record);
    }

    // Helper to identify the month of a date.
    const getMonthKey = (date) => {
        const parsedDate = new Date(date);

        const month = String(
            parsedDate.getUTCMonth() + 1
        ).padStart(2, "0");

        return `${parsedDate.getUTCFullYear()}-${month}`;
    };

    // 7. Count drives using driveDate.
    for (const drive of drives) {
        if (!drive.driveDate) continue;

        const key = getMonthKey(drive.driveDate);
        const monthRecord = monthlyMap.get(key);

        if (monthRecord) {
            monthRecord.totalDrives++;
        }
    }

    // 8. Calculate selection and offer statistics.
    for (const selection of selections) {
        const key = getMonthKey(selection.selectedAt);
        const monthRecord = monthlyMap.get(key);

        if (!monthRecord) continue;

        monthRecord.studentsSelected++;

        if (selection.status === "OFFER_ACCEPTED") {
            monthRecord.offersAccepted++;
        }

        // Only positive, finite packages are included
        // in the average package calculation.
        if (
            Number.isFinite(selection.packageLPA) &&
            selection.packageLPA > 0
        ) {
            monthRecord.packageTotal += selection.packageLPA;
            monthRecord.packageCount++;
        }
    }

    // 9. Calculate averages and remove internal fields.
    return monthlyData.map((record) => {
        const averagePackageLPA =
            record.packageCount > 0
                ? Number(
                    (
                        record.packageTotal /
                        record.packageCount
                    ).toFixed(2)
                )
                : 0;

        return {
            month: record.month,
            totalDrives: record.totalDrives,
            studentsSelected: record.studentsSelected,
            offersAccepted: record.offersAccepted,
            averagePackageLPA
        };
    });
};

const getDepartmentsAnalytics = async ({
    academicYear,
    departmentId
}) => {

    // Academic year: 2026-27
    // Graduation year: 2027
    const graduationYear = Number(academicYear.split("-")[0]) + 1;

    // Check whether the requested department exists
    if (departmentId) {
        const departmentExists = await prisma.department.findUnique({
            where: {
                id: departmentId
            },
            select: {
                id: true
            }
        });

        if (!departmentExists) {
            const error = new Error("Department not found");
            error.statusCode = 400;
            throw error;
        }
    }

    // Fetch departments and their students for the selected year
    const departments = await prisma.department.findMany({

        where: departmentId
            ? { id: departmentId }
            : {},

        orderBy: {
            name: "asc"
        },

        select: {
            id: true,
            name: true,

            students: {
                where: {
                    graduationYear: graduationYear
                },

                select: {
                    id: true,

                    selection: {
                        select: {
                            status: true,
                            packageLPA: true
                        }
                    }
                }
            }
        }
    });

    // Calculate analytics department-wise
    const result = departments.map((department) => {

        const totalStudents = department.students.length;

        // Only SELECTED and OFFER_ACCEPTED count as placed
        const placedStudents = department.students.filter((student) => {

            return (
                student.selection &&
                (
                    student.selection.status === "SELECTED" ||
                    student.selection.status === "OFFER_ACCEPTED"
                )
            );

        });

        const placedCount = placedStudents.length;

        const notPlacedStudents = totalStudents - placedCount;

        // Calculate placement percentage
        const placementPercentage = totalStudents > 0
            ? Number(((placedCount / totalStudents) * 100).toFixed(2))
            : 0;

        // Get valid package values from successfully placed students
        const packages = placedStudents
            .map((student) => Number(student.selection.packageLPA))
            .filter((value) => Number.isFinite(value) && value > 0);

        // Calculate average package
        const averagePackageLPA = packages.length > 0
            ? Number((
                packages.reduce((sum, value) => sum + value, 0) /
                packages.length
            ).toFixed(2))
            : 0;

        // Calculate highest package
        const highestPackageLPA = packages.length > 0
            ? Number(Math.max(...packages).toFixed(2))
            : 0;

        return {
            departmentId: department.id,
            departmentName: department.name,
            totalStudents,
            placedStudents: placedCount,
            notPlacedStudents,
            placementPercentage,
            averagePackageLPA,
            highestPackageLPA
        };
    });

    return result;
};


const SUCCESSFUL_STATUSES = ["SELECTED", "OFFER_ACCEPTED"];

const getCompaniesAnalytics = async ({
  academicYear,
  companyId,
  departmentId,
}) => {
  const startYear = Number(academicYear.split("-")[0]);

  // Academic year runs from July to June.
  const startDate = new Date(Date.UTC(startYear, 6, 1));
  const endDate = new Date(Date.UTC(startYear + 1, 6, 1));

  // A company drive is counted when its driveDate falls
  // within the selected academic year.
  const driveWhere = {
    driveDate: {
      gte: startDate,
      lt: endDate,
    },
    ...(departmentId
      ? {
          eligibleBranches: {
            some: { departmentId },
          },
        }
      : {}),
  };

  // Selection statistics use the selection event date.
  const selectionWhere = {
    selectedAt: {
      gte: startDate,
      lt: endDate,
    },
    ...(departmentId
      ? {
          student: {
            departmentId,
          },
        }
      : {}),
  };

  const companies = await prisma.company.findMany({
    where: companyId ? { id: companyId } : {},
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      placementDrives: {
        where: driveWhere,
        select: {
          id: true,
          selections: {
            where: selectionWhere,
            select: {
              studentId: true,
              status: true,
              packageLPA: true,
            },
          },
        },
      },
    },
  });

  return companies.map((company) => {
    const allSelections = company.placementDrives.flatMap(
      (drive) => drive.selections
    );

    // Count unique students, not multiple drives/selections.
    const selectedStudentIds = new Set(
      allSelections
        .filter((selection) =>
          SUCCESSFUL_STATUSES.includes(selection.status)
        )
        .map((selection) => selection.studentId)
    );

    const offersAccepted = allSelections.filter(
      (selection) => selection.status === "OFFER_ACCEPTED"
    ).length;

    const offersDeclined = allSelections.filter(
      (selection) => selection.status === "OFFER_DECLINED"
    ).length;

    // Package offered is included even if the student declined it.
    const validPackages = allSelections
      .map((selection) => Number(selection.packageLPA))
      .filter((value) => Number.isFinite(value) && value > 0);

    const averagePackageLPA =
      validPackages.length > 0
        ? Number(
            (
              validPackages.reduce((sum, value) => sum + value, 0) /
              validPackages.length
            ).toFixed(2)
          )
        : 0;

    const highestPackageLPA =
      validPackages.length > 0 ? Math.max(...validPackages) : 0;

    return {
      companyId: company.id,
      companyName: company.name,
      totalDrives: company.placementDrives.length,
      studentsSelected: selectedStudentIds.size,
      offersAccepted,
      offersDeclined,
      averagePackageLPA,
      highestPackageLPA,
    };
  });
};

const getYearlyAnalytics = async ({
  fromYear,
  toYear,
  departmentId
}) => {
  const result = [];

  const startYear = Number(fromYear.split("-")[0]);
  const endYear = Number(toYear.split("-")[0]);

  // Loop through every academic year in the requested range.
  for (let year = startYear; year <= endYear; year++) {

    const academicYear =
      `${year}-${String((year + 1) % 100).padStart(2, "0")}`;

    // Example: academic year 2023-24 corresponds to graduationYear 2024.
    const graduationYear = year + 1;

    const studentWhere = {
      graduationYear,
      ...(departmentId !== undefined ? { departmentId } : {})
    };

    // 1. Count total students in this academic year.
    const totalStudents = await prisma.student.count({
      where: studentWhere
    });

    // 2. Find students who are selected or have accepted an offer.
    const selections = await prisma.studentSelection.findMany({
      where: {
        status: {
          in: ["SELECTED", "OFFER_ACCEPTED"]
        },
        student: {
          is: studentWhere
        }
      },
      select: {
        studentId: true,
        packageLPA: true
      }
    });

    // 3. Count unique placed students.
    const placedStudents = new Set(
      selections.map((selection) => selection.studentId)
    ).size;

    // 4. Calculate placement percentage.
    const placementPercentage =
      totalStudents > 0
        ? Number(
            ((placedStudents / totalStudents) * 100).toFixed(2)
          )
        : 0;

    // 5. Get valid package values.
    const packages = selections
      .map((selection) => Number(selection.packageLPA))
      .filter((pkg) => Number.isFinite(pkg) && pkg > 0);

    // 6. Calculate average package.
    const averagePackageLPA =
      packages.length > 0
        ? Number(
            (
              packages.reduce((sum, pkg) => sum + pkg, 0) /
              packages.length
            ).toFixed(2)
          )
        : 0;

    // 7. Calculate highest package.
    const highestPackageLPA =
      packages.length > 0
        ? Math.max(...packages)
        : 0;

    // 8. Store this academic year's analytics.
    result.push({
      academicYear,
      totalStudents,
      placedStudents,
      placementPercentage,
      averagePackageLPA,
      highestPackageLPA
    });
  }

  return result;
};

module.exports = {
  getOverviewAnalytics,
  getMonthlyAnalytics,
  getDepartmentsAnalytics,
  getCompaniesAnalytics,
  getYearlyAnalytics
};
