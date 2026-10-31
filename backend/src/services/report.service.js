const prisma = require("../prismaClient");

const getStudentReport = async (filters) => {
  const { search, department, batch, company, placementStatus } = filters;

  const where = {
    AND: [],
  };

  // 1. Search by name, PRN or company
  if (search) {
    where.AND.push({
      OR: [
        {
          user: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          PRN: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          selection: {
            is: {
              drive: {
                company: {
                  name: {
                    contains: search,
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
      throw new Error("Invalid batch format. Use YYYY-YY, e.g. 2026-27");
    }

    const startYear = Number(match[1]);
    const endYear = Number(`${String(startYear).slice(0, 2)}${match[2]}`);

    if (endYear !== startYear + 1) {
      throw new Error("Invalid academic year range");
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
      throw new Error("Invalid placement status. Use PLACED or NOT_PLACED.");
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

  // 6. Fetch students
  const students = await prisma.student.findMany({
    where,
    include: {
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
    },
    orderBy: {
      PRN: "asc",
    },
  });

  // 7. Format report data
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

module.exports = {
  getStudentReport,
};
