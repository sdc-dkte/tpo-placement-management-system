const prisma = require("../prismaClient");

// 1. Get all job roles belonging to a company
const getCompanyJobRoles = async (req, res) => {
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

    const jobRoles = await prisma.jobRole.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { placementDrives: true },
        },
      },
      orderBy: { title: "asc" },
    });

    return res.status(200).json({
      success: true,
      data: jobRoles,
    });
  } catch (error) {
    console.error("Get company job roles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job roles.",
    });
  }
};

// 2. Create a job role under a specific company
const createCompanyJobRole = async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    const { title, description, domain } = req.body;

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid company ID.",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Job role title is required.",
      });
    }

    for (const [field, value] of Object.entries({
      description,
      domain,
    })) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({
          success: false,
          message: `${field} must be a string or null.`,
        });
      }
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

    const jobRole = await prisma.jobRole.create({
      data: {
        companyId,
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        domain:
          typeof domain === "string" && domain.trim() ? domain.trim() : null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Job role created successfully.",
      data: jobRole,
    });
  } catch (error) {
    console.error("Create job role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create job role.",
    });
  }
};

// 3. Get one job role and its associated drives
const getJobRoleById = async (req, res) => {
  try {
    const jobRoleId = Number(req.params.jobRoleId);

    if (!Number.isInteger(jobRoleId) || jobRoleId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid job role ID.",
      });
    }

    const jobRole = await prisma.jobRole.findUnique({
      where: { id: jobRoleId },
      include: {
        company: true,
        placementDrives: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!jobRole) {
      return res.status(404).json({
        success: false,
        message: "Job role not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: jobRole,
    });
  } catch (error) {
    console.error("Get job role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job role.",
    });
  }
};

// 4. Update only the fields provided
const updateJobRole = async (req, res) => {
  try {
    const jobRoleId = Number(req.params.jobRoleId);

    if (!Number.isInteger(jobRoleId) || jobRoleId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid job role ID.",
      });
    }

    const { title, description, domain } = req.body;
    const data = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Job role title cannot be empty.",
        });
      }
      data.title = title.trim();
    }

    for (const [field, value] of Object.entries({
      description,
      domain,
    })) {
      if (value !== undefined) {
        if (value !== null && typeof value !== "string") {
          return res.status(400).json({
            success: false,
            message: `${field} must be a string or null.`,
          });
        }

        data[field] =
          typeof value === "string" && value.trim() ? value.trim() : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const jobRole = await prisma.jobRole.update({
      where: { id: jobRoleId },
      data,
    });

    return res.status(200).json({
      success: true,
      message: "Job role updated successfully.",
      data: jobRole,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Job role not found.",
      });
    }

    console.error("Update job role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update job role.",
    });
  }
};

// 5. Delete only when no placement drive uses the role
const deleteJobRole = async (req, res) => {
  try {
    const jobRoleId = Number(req.params.jobRoleId);

    if (!Number.isInteger(jobRoleId) || jobRoleId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid job role ID.",
      });
    }

    const jobRole = await prisma.jobRole.findUnique({
      where: { id: jobRoleId },
      include: {
        _count: {
          select: { placementDrives: true },
        },
      },
    });

    if (!jobRole) {
      return res.status(404).json({
        success: false,
        message: "Job role not found.",
      });
    }

    if (jobRole._count.placementDrives > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this job role because it is used by a placement drive. Preserve the role and its history.",
      });
    }

    await prisma.jobRole.delete({
      where: { id: jobRoleId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Delete job role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete job role.",
    });
  }
};

module.exports = {
  getCompanyJobRoles,
  createCompanyJobRole,
  getJobRoleById,
  updateJobRole,
  deleteJobRole,
};
