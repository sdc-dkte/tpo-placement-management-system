const prisma = require("../prismaClient");
const ValidationError = require("../utils/ValidationError");

// Build Prisma filters
const buildStudentReportWhere = (filters) => {
  const { search, department, batch, company, placementStatus } = filters;

  const queryParams = { search, department, batch, company, placementStatus };

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && typeof value !== "string") {
      throw new ValidationError(`${key} must be a string`);
    }
  }

  const where = {
    AND: [],
  };

  // 1. Search by name, PRN or company
  if (search?.trim()) {
    const searchValue = search.trim();

    where.AND.push({
      OR: [
        {
          user: {
            name: {
              contains: searchValue,
              mode: "insensitive",
            },
          },
        },
        {
          PRN: {
            contains: searchValue,
            mode: "insensitive",
          },
        },
        {
          selection: {
            is: {
              drive: {
                company: {
                  name: {
                    contains: searchValue,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
        },
      ],
    });
  }

  // 2. Department filter
  if (department) {
    where.AND.push({
      department: {
        name: {
          equals: department,
          mode: "insensitive",
        },
      },
    });
  }

  // 3. Batch filter
  if (batch) {
    const match = batch.match(/^(\d{4})-(\d{2})$/);

    if (!match) {
      throw new ValidationError("Invalid batch format. Use YYYY-YY, e.g. 2026-27");
    }

    const startYear = Number(match[1]);
    const endYear = Number(`${String(startYear).slice(0, 2)}${match[2]}`);

    if (endYear !== startYear + 1) {
      throw new ValidationError("Invalid academic year range");
    }

    where.AND.push({
      graduationYear: endYear,
    });
  }

  // 4. Company filter
  if (company) {
    where.AND.push({
      selection: {
        is: {
          drive: {
            company: {
              name: {
                equals: company,
                mode: "insensitive",
              },
            },
          },
        },
      },
    });
  }

  // 5. Placement status filter
  if (placementStatus) {
    const status = placementStatus.toUpperCase();

    if (!["PLACED", "NOT_PLACED"].includes(status)) {
      throw new ValidationError("Invalid placement status. Use PLACED or NOT_PLACED.");
    }

    if (status === "PLACED") {
      where.AND.push({
        selection: {
          is: {
            status: {
              in: ["SELECTED", "OFFER_ACCEPTED"],
            },
          },
        },
      });
    } else {
      where.AND.push({
        OR: [
          { selection: { is: null } },
          {
            selection: {
              is: {
                status: "OFFER_DECLINED",
              },
            },
          },
        ],
      });
    }
  }

  return where;
};

// Format student data
const formatStudentReport = (students) => {
  return students.map((data) => {
    const selection = data.selection;

    const isPlaced = selection?.status === "SELECTED" || selection?.status === "OFFER_ACCEPTED";

    return {
      id: data.id,
      name: data.user.name,
      PRN: data.PRN,
      department: data.department.name,
      batch: `${data.graduationYear - 1}-${String(data.graduationYear).slice(-2)}`,
      placementStatus: isPlaced ? "PLACED" : "NOT_PLACED",
      company: selection?.drive?.company?.name ?? null,
      packageLPA: selection?.packageLPA ?? null,
      offerStatus: selection?.status ?? null,
    };
  });
};

// Common student query
const studentInclude = {
  user: {
    select: {
      name: true,
    },
  },
  department: {
    select: {
      name: true,
    },
  },
  selection: {
    include: {
      drive: {
        include: {
          company: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
};

// Existing function: fetch all matching students (used by exports)
// Fetch all matching students in batches (used by exports)
const getStudentReport = async (filters) => {
  const where = buildStudentReportWhere(filters);

  const batchSize = 500;
  let skip = 0;

  const allStudents = [];

  while (true) {
    const students = await prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: {
        PRN: "asc",
      },
      skip,
      take: batchSize,
    });

    if (students.length === 0) {
      break;
    }

    allStudents.push(...formatStudentReport(students));

    skip += batchSize;

    if (students.length < batchSize) {
      break;
    }
  }

  return allStudents;
};

// New function: fetch paginated students (used by dashboard)
const getPaginatedStudentReport = async (filters, page, limit) => {
  const where = buildStudentReportWhere(filters);

  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedLimit = limit === undefined ? 10 : Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new ValidationError("Page must be a positive integer");
  }

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new ValidationError("Limit must be an integer between 1 and 100");
  }

  const skip = (parsedPage - 1) * parsedLimit;

  // Fetch students and total matching count together
  const [students, totalStudents] = await Promise.all([
    prisma.student.findMany({
      where,
      include: studentInclude,
      orderBy: {
        PRN: "asc",
      },
      skip,
      take: parsedLimit,
    }),

    prisma.student.count({
      where,
    }),
  ]);

  return {
    data: formatStudentReport(students),
    total: totalStudents,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(totalStudents / parsedLimit),
  };
};

module.exports = {
  getStudentReport,
  getPaginatedStudentReport,
};
