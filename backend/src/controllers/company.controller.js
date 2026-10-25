const prisma = require("../prismaClient");

// 1. Get all companies, with optional search and pagination

const getCompanies = async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const pageValue = req.query.page;
    const limitValue = req.query.limit;

    const page = pageValue === undefined ? 1 : Number(pageValue);
    const limit = limitValue === undefined ? 20 : Number(limitValue);
if (
  !Number.isInteger(page) ||
  page < 1 ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 100
) {
  return res.status(400).json({
    success: false,
    message: "Page must be a positive integer and limit must be between 1 and 100.",
  });
}

    // Build filters for company name and active status
    const where = {
      ...(search
        ? { name: { contains: search, mode: "insensitive" } }
        : {}),
    };

    // Apply isActive only when the query parameter is provided
    if (req.query.isActive !== undefined) {
      if (req.query.isActive !== "true" &&
          req.query.isActive !== "false") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
      }

      where.isActive = req.query.isActive === "true";
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              jobRoles: true,
              placementDrives: true,
            },
          },
        },
      }),
      prisma.company.count({ where }),
    ]);

    // Return counts in the format required by Module 8
    const data = companies.map((company) => {
      const { _count, ...companyDetails } = company;

      return {
        ...companyDetails,
        jobRoleCount: _count.jobRoles,
        driveCount: _count.placementDrives,
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
    console.error("Get companies error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies.",
    });
  }
};


const createCompany = async (req, res) => {
  try {
    const { name, website, description, isActive } = req.body;

    // Validate company name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Company name is required.",
      });
    }

    // Validate isActive when provided
    if (
      isActive !== undefined &&
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value.",
      });
    }

if (website !== undefined && website !== null &&
    typeof website !== "string") {
  return res.status(400).json({
    success: false,
    message: "Website must be a string or null.",
  });
}

const cleanWebsite =
  typeof website === "string" && website.trim()
    ? website.trim()
    : null;

    // Validate website URL
    if (cleanWebsite) {
      try {
        const parsedUrl = new URL(cleanWebsite);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: "Website must be a valid HTTP or HTTPS URL.",
        });
      }
    }

    // Create company with the supplied active status
   if (description !== undefined && description !== null &&
    typeof description !== "string") {
  return res.status(400).json({
    success: false,
    message: "Description must be a string or null.",
  });
    }

    const cleanName = name.trim();

    const company = await prisma.company.create({
      data: {
        name: cleanName,
        website: cleanWebsite,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        isActive: isActive ?? true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Company created successfully.",
      data: company,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A company with this name already exists.",
      });
    }

    console.error("Create company error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create company.",
    });
  }
};

// 3. Get company details, job roles, and placement drives
const getCompanyById = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID.",
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
    jobRoles: true,
    placementDrives: {
        include: {
            jobRole: true,
        },
    },
},
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Get company error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company.",
    });
  }
};

// 4. Update only the fields provided in the request
const updateCompany = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID.",
      });
    }

    const { name, website, description, isActive } = req.body;
    const data = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Company name cannot be empty.",
        });
      }
      data.name = name.trim();
    }

    if (website !== undefined) {
      if (website !== null && typeof website !== "string") {
        return res.status(400).json({
          success: false,
          message: "Website must be a string or null.",
        });
      }

      const cleanWebsite = typeof website === "string" ? website.trim() : "";

      if (cleanWebsite) {
        try {
          const parsedUrl = new URL(cleanWebsite);
          if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          return res.status(400).json({
            success: false,
            message: "Website must be a valid HTTP or HTTPS URL.",
          });
        }
        data.website = cleanWebsite;
      } else {
        data.website = null;
      }
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null.",
        });
      }
      data.description =
        typeof description === "string" && description.trim()
          ? description.trim()
          : null;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
      }
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      data: company,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "A company with this name already exists.",
      });
    }

    console.error("Update company error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update company.",
    });
  }
};

//
const getCompanyPlacements = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID.",
      });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    // Read pagination values from the query string
    const pageValue = req.query.page;
const limitValue = req.query.limit;

const page = pageValue === undefined ? 1 : Number(pageValue);
const limit = limitValue === undefined ? 20 : Number(limitValue);

if (
  !Number.isInteger(page) ||
  page < 1 ||
  !Number.isInteger(limit) ||
  limit < 1 ||
  limit > 100
) {
  return res.status(400).json({
    success: false,
    message:
      "Page must be a positive integer and limit must be between 1 and 100.",
  });
}
    const skip = (page - 1) * limit;

    const where = {
      drive: { companyId },
    };

    // Fetch placements and total count together
    const [placements, total] = await Promise.all([
      prisma.studentSelection.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              department: true,
            },
          },
          drive: {
            include: {
              jobRole: true,
            },
          },
        },
        orderBy: { selectedAt: "desc" },
      }),
      prisma.studentSelection.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: placements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get company placements error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company placements.",
    });
  }
};


module.exports = {
  getCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  getCompanyPlacements,
};
