const prisma = require("../prismaClient");
const ValidationError = require("../utils/ValidationError");

// Only these statuses count as successful placements.
const PLACED_STATUSES = ["SELECTED", "OFFER_ACCEPTED"];

// Maximum number of academic years allowed in one yearly request.
const MAX_YEARLY_RANGE = 10;

// --------------------------------------------------
// 1. COMMON VALIDATION HELPERS
// --------------------------------------------------

const badRequest = (message) => {
  const error = new ValidationError(message);
  error.statusCode = 400;
  return error;
};

/**
 * Validates and converts an academic year.
 *
 * Example:
 * 2026-27
 * Graduation year: 2027
 * Start date: 1 July 2026
 * End date: 1 July 2027 (exclusive)
 */
const parseAcademicYear = (academicYear, required = false) => {
  if (academicYear === undefined || academicYear === "") {
    if (required) {
      throw badRequest("academicYear is required.");
    }

    return null;
  }

  if (typeof academicYear !== "string") {
    throw badRequest(
      "academicYear must be a string in YYYY-YY format."
    );
  }

  const match = /^(\d{4})-(\d{2})$/.exec(academicYear);

  if (!match) {
    throw badRequest(
      "Invalid academicYear. Use YYYY-YY format, e.g. 2026-27."
    );
  }

  const startYear = Number(match[1]);
  const endingYear = Number(match[2]);

  if (startYear < 1900 || startYear > 2099) {
    throw badRequest(
      "Academic year must start between 1900 and 2099."
    );
  }

  if (endingYear !== (startYear + 1) % 100) {
    throw badRequest(
      "Invalid academic year range. The ending year must be one year after the starting year."
    );
  }

  return {
    academicYear,
    startYear,
    graduationYear: startYear + 1,
    startDate: new Date(Date.UTC(startYear, 6, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
};

/**
 * Validates a positive safe integer ID.
 */
const validateId = (id, fieldName) => {
  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw badRequest(`${fieldName} must be a positive safe integer.`);
  }
};

/**
 * Checks whether a department exists.
 */
const validateDepartmentExists = async (departmentId) => {
  if (departmentId === undefined) return;

  validateId(departmentId, "departmentId");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true },
  });

  if (!department) {
    throw badRequest("Department not found.");
  }
};

/**
 * Checks whether a company exists.
 */
const validateCompanyExists = async (companyId) => {
  if (companyId === undefined) return;

  validateId(companyId, "companyId");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!company) {
    throw badRequest("Company not found.");
  }
};

/**
 * Rounds a number to two decimal places.
 */
const roundToTwo = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toFixed(2));
};

// --------------------------------------------------
// 2. OVERVIEW ANALYTICS
// --------------------------------------------------

const getOverviewAnalytics = async (academicYear) => {
  const year = parseAcademicYear(academicYear);

  const studentWhere = year
    ? { graduationYear: year.graduationYear }
    : {};

  const selectionWhere = {
    status: {
      in: PLACED_STATUSES,
    },
    ...(year && {
    student: {
      is: {
        graduationYear: year.graduationYear,
      },
    },
  }),
};

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
    prisma.student.count({
      where: studentWhere,
    }),

    prisma.studentSelection.count({
      where: selectionWhere,
    }),

    prisma.placementDrive.count({
      where: driveWhere,
    }),

    prisma.company.count({
      where: {
        placementDrives: {
          some: driveWhere,
        },
      },
    }),

    // Declined offers are excluded from package statistics.
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
    totalStudents > 0
      ? (placedStudents / totalStudents) * 100
      : 0;

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

// --------------------------------------------------
// 3. MONTHLY ANALYTICS
// --------------------------------------------------

const getMonthlyAnalytics = async ({
  academicYear,
  year,
  departmentId,
  companyId,
}) => {
  if (academicYear !== undefined && year !== undefined) {
    throw badRequest(
      "Provide either academicYear or year, not both."
    );
  }

  await Promise.all([
    validateDepartmentExists(departmentId),
    validateCompanyExists(companyId),
  ]);

  let startYear;
  let startMonth;

  if (year !== undefined) {
    if (
      !Number.isSafeInteger(year) ||
      year < 1900 ||
      year > 2099
    ) {
      throw badRequest("year must be a valid calendar year between 1900 and 2099.");
    }

    startYear = year;
    startMonth = 0;
  } else if (academicYear !== undefined) {
    const parsedYear = parseAcademicYear(academicYear);

    startYear = parsedYear.startYear;
    startMonth = 6;
  } else {
    const currentDate = new Date();
    const currentYear = currentDate.getUTCFullYear();

    startYear =
      currentDate.getUTCMonth() >= 6
        ? currentYear
        : currentYear - 1;

    startMonth = 6;
  }

  const startDate = new Date(
    Date.UTC(startYear, startMonth, 1)
  );

  const endDate = new Date(
    Date.UTC(startYear, startMonth + 12, 1)
  );

  // Drives within the selected period.
  const driveWhere = {
    driveDate: {
      gte: startDate,
      lt: endDate,
    },
    ...(companyId !== undefined && { companyId }),
    ...(departmentId !== undefined && {
      eligibleBranches: {
        some: { departmentId },
      },
    }),
  };

  // Only successful placements are included.
  const selectionWhere = {
    selectedAt: {
      gte: startDate,
      lt: endDate,
    },
    status: {
      in: PLACED_STATUSES,
    },
    ...(departmentId !== undefined && {
      student: {
        is: { departmentId },
      },
    }),
    ...(companyId !== undefined && {
      drive: {
        is: { companyId },
      },
    }),
  };

  const [drives, selections] = await Promise.all([
    prisma.placementDrive.findMany({
      where: driveWhere,
      select: {
        driveDate: true,
      },
    }),

    prisma.studentSelection.findMany({
      where: selectionWhere,
      select: {
        selectedAt: true,
        status: true,
        packageLPA: true,
      },
    }),
  ]);

  // Create 12 monthly buckets.
  const monthlyData = [];
  const monthlyMap = new Map();

  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(
      Date.UTC(startYear, startMonth + i, 1)
    );

    const month = monthDate.toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
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
      packageCount: 0,
    };

    monthlyData.push(record);
    monthlyMap.set(monthKey, record);
  }

  const getMonthKey = (date) => {
    const parsedDate = new Date(date);

    const month = String(
      parsedDate.getUTCMonth() + 1
    ).padStart(2, "0");

    return `${parsedDate.getUTCFullYear()}-${month}`;
  };

  // Count drives by driveDate.
  for (const drive of drives) {
    if (!drive.driveDate) continue;

    const key = getMonthKey(drive.driveDate);
    const monthRecord = monthlyMap.get(key);

    if (monthRecord) {
      monthRecord.totalDrives++;
    }
  }

  // Calculate successful selection and offer statistics.
  for (const selection of selections) {
  const key = getMonthKey(selection.selectedAt);
  const monthRecord = monthlyMap.get(key);

  if (!monthRecord) continue;

  monthRecord.studentsSelected++;

  if (selection.status === "OFFER_ACCEPTED") {
    monthRecord.offersAccepted++;
  }

  // Only successful placements contribute to package statistics.
  if (PLACED_STATUSES.includes(selection.status)) {
    const packageValue = Number(selection.packageLPA);

    if (
      Number.isFinite(packageValue) &&
      packageValue > 0
    ) {
      monthRecord.packageTotal += packageValue;
      monthRecord.packageCount++;
    }
  }
}

  return monthlyData.map((record) => {
    const averagePackageLPA =
      record.packageCount > 0
        ? roundToTwo(
            record.packageTotal / record.packageCount
          )
        : 0;

    return {
      month: record.month,
      totalDrives: record.totalDrives,
      studentsSelected: record.studentsSelected,
      offersAccepted: record.offersAccepted,
      averagePackageLPA,
    };
  });
};

// --------------------------------------------------
// 4. DEPARTMENT ANALYTICS
// --------------------------------------------------

const getDepartmentsAnalytics = async ({
  academicYear,
  departmentId,
}) => {
  const year = parseAcademicYear(academicYear, true);

  await validateDepartmentExists(departmentId);

  const departments = await prisma.department.findMany({
    where:
      departmentId !== undefined
        ? { id: departmentId }
        : {},

    orderBy: {
      name: "asc",
    },

    select: {
      id: true,
      name: true,

      students: {
        where: {
          graduationYear: year.graduationYear,
        },

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

  return departments.map((department) => {
    const totalStudents = department.students.length;

    const placedStudents = department.students.filter(
      (student) =>
        student.selection &&
        PLACED_STATUSES.includes(student.selection.status)
    );

    const placedCount = placedStudents.length;

    const notPlacedStudents = Math.max(
      totalStudents - placedCount,
      0
    );

    const placementPercentage =
      totalStudents > 0
        ? roundToTwo((placedCount / totalStudents) * 100)
        : 0;

    // Only successful placements contribute to package statistics.
    const packages = placedStudents
      .map((student) => Number(student.selection.packageLPA))
      .filter(
        (value) => Number.isFinite(value) && value > 0
      );

    const averagePackageLPA =
      packages.length > 0
        ? roundToTwo(
            packages.reduce((sum, value) => sum + value, 0) /
              packages.length
          )
        : 0;

    const highestPackageLPA =
      packages.length > 0
        ? roundToTwo(Math.max(...packages))
        : 0;

    return {
      departmentId: department.id,
      departmentName: department.name,
      totalStudents,
      placedStudents: placedCount,
      notPlacedStudents,
      placementPercentage,
      averagePackageLPA,
      highestPackageLPA,
    };
  });
};

// --------------------------------------------------
// 5. COMPANY ANALYTICS
// --------------------------------------------------

const getCompaniesAnalytics = async ({
  academicYear,
  companyId,
  departmentId,
}) => {
  const year = parseAcademicYear(academicYear, true);

  await Promise.all([
    validateCompanyExists(companyId),
    validateDepartmentExists(departmentId),
  ]);

  const driveWhere = {
    driveDate: {
      gte: year.startDate,
      lt: year.endDate,
    },
    ...(departmentId !== undefined && {
      eligibleBranches: {
        some: { departmentId },
      },
    }),
  };

  const selectionWhere = {
    selectedAt: {
      gte: year.startDate,
      lt: year.endDate,
    },
    ...(departmentId !== undefined && {
      student: {
        is: { departmentId },
      },
    }),
  };

  const companies = await prisma.company.findMany({
    where:
      companyId !== undefined
        ? { id: companyId }
        : {},

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

    // Count unique students with successful placement statuses.
    const selectedStudentIds = new Set(
      allSelections
        .filter((selection) =>
          PLACED_STATUSES.includes(selection.status)
        )
        .map((selection) => selection.studentId)
    );

    const offersAccepted = allSelections.filter(
      (selection) => selection.status === "OFFER_ACCEPTED"
    ).length;

    const offersDeclined = allSelections.filter(
      (selection) => selection.status === "OFFER_DECLINED"
    ).length;

    // IMPORTANT:
    // Declined offers must not contribute to package statistics.
    const validPackages = allSelections
      .filter((selection) =>
        PLACED_STATUSES.includes(selection.status)
      )
      .map((selection) => Number(selection.packageLPA))
      .filter(
        (value) => Number.isFinite(value) && value > 0
      );

    const averagePackageLPA =
      validPackages.length > 0
        ? roundToTwo(
            validPackages.reduce((sum, value) => sum + value, 0) /
              validPackages.length
          )
        : 0;

    const highestPackageLPA =
      validPackages.length > 0
        ? roundToTwo(Math.max(...validPackages))
        : 0;

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

// --------------------------------------------------
// 6. YEARLY ANALYTICS
// --------------------------------------------------

const getYearlyAnalytics = async ({
  fromYear,
  toYear,
  departmentId,
}) => {
  const from = parseAcademicYear(fromYear, true);
  const to = parseAcademicYear(toYear, true);

  await validateDepartmentExists(departmentId);

  if (from.startYear > to.startYear) {
    throw badRequest(
      "fromYear cannot be greater than toYear."
    );
  }

  const numberOfYears = to.startYear - from.startYear + 1;

  if (numberOfYears > MAX_YEARLY_RANGE) {
    throw badRequest(
      `The maximum allowed yearly analytics range is ${MAX_YEARLY_RANGE} academic years.`
    );
  }

  const result = [];

  for (
    let startYear = from.startYear;
    startYear <= to.startYear;
    startYear++
  ) {
    const academicYear =
      `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

    // Example: 2023-24 corresponds to graduationYear 2024.
    const graduationYear = startYear + 1;

    const studentWhere = {
      graduationYear,
      ...(departmentId !== undefined && { departmentId }),
    };

    const totalStudents = await prisma.student.count({
      where: studentWhere,
    });

    const selections = await prisma.studentSelection.findMany({
      where: {
        status: {
        in: PLACED_STATUSES,
      },

      selectedAt: {
        gte: new Date(Date.UTC(startYear, 6, 1)),
        lt: new Date(Date.UTC(startYear + 1, 6, 1)),
      },

      student: {
        is: studentWhere,
      },
    },

      select: {
        studentId: true,
        packageLPA: true,
      },
    });

    const placedStudents = new Set(
      selections.map((selection) => selection.studentId)
    ).size;

    const placementPercentage =
      totalStudents > 0
        ? roundToTwo((placedStudents / totalStudents) * 100)
        : 0;

    // Only successful placements contribute to package statistics.
    const packages = selections
      .map((selection) => Number(selection.packageLPA))
      .filter(
        (value) => Number.isFinite(value) && value > 0
      );

    const averagePackageLPA =
      packages.length > 0
        ? roundToTwo(
            packages.reduce((sum, value) => sum + value, 0) /
              packages.length
          )
        : 0;

    const highestPackageLPA =
      packages.length > 0
        ? roundToTwo(Math.max(...packages))
        : 0;

    result.push({
      academicYear,
      totalStudents,
      placedStudents,
      placementPercentage,
      averagePackageLPA,
      highestPackageLPA,
    });
  }

  return result;
};

// --------------------------------------------------
// EXPORT ALL ANALYTICS SERVICES
// --------------------------------------------------

module.exports = {
  getOverviewAnalytics,
  getMonthlyAnalytics,
  getDepartmentsAnalytics,
  getCompaniesAnalytics,
  getYearlyAnalytics,
};