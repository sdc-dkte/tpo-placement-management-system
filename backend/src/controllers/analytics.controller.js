const {
  getOverviewAnalytics,
  getMonthlyAnalytics,
  getDepartmentsAnalytics,
  getCompaniesAnalytics,
  getYearlyAnalytics
} = require("../services/analytics.service");

const ValidationError = require("../utils/ValidationError");

const getOverview = async (req, res) => {
  try {
    // Only academicYear is supported by this endpoint.
    const allowedParams = ["academicYear"];

    const invalidParams = Object.keys(req.query).filter(
      (key) => !allowedParams.includes(key)
    );

    if (invalidParams.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Unsupported query parameter(s): ${invalidParams.join(", ")}`,
        },
      });
    }

    const { academicYear } = req.query;

    const analytics = await getOverviewAnalytics(academicYear);

    return res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    console.error("Overview analytics error:", error);

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch overview analytics.",
      },
    });
  }
};


const getMonthly = async (req, res) => {
    try {
        // Helper for returning validation errors.
        const badRequest = (message) => {
            const error = new Error(message);
            error.statusCode = 400;
            throw error;
        };

        // 1. Reject unsupported query parameters.
        const allowedParams = [
            "academicYear",
            "year",
            "departmentId",
            "companyId"
        ];

        const unknownParams = Object.keys(req.query).filter(
            (key) => !allowedParams.includes(key)
        );

        if (unknownParams.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Unsupported query parameter: ${unknownParams.join(", ")}`
            });
        }

        // 2. Read single string query values.
        const getStringParam = (key) => {
            const value = req.query[key];

            if (value === undefined) {
                return undefined;
            }

            if (
                typeof value !== "string" ||
                value.trim() === ""
            ) {
                badRequest(`${key} must be a valid non-empty value.`);
            }

            return value.trim();
        };

        const academicYear = getStringParam("academicYear");
        const yearValue = getStringParam("year");
        const departmentValue = getStringParam("departmentId");
        const companyValue = getStringParam("companyId");

        // 3. Do not allow academicYear and year together.
        if (academicYear && yearValue) {
            badRequest(
                "Provide either academicYear or year, not both."
            );
        }

        // 4. Validate academic year.
        if (academicYear !== undefined) {
            const match = /^(\d{4})-(\d{2})$/.exec(academicYear);

            if (!match) {
                badRequest(
                    "academicYear must follow YYYY-YY format, e.g. 2026-27."
                );
            }

            const start = Number(match[1]);
            const end = Number(match[2]);

            if (
                start < 1900 ||
                start > 2099 ||
                end !== (start + 1) % 100
            ) {
                badRequest(
                    "Invalid academicYear. The ending year must be the next year."
                );
            }
        }

        // 5. Validate calendar year.
        let year;

        if (yearValue !== undefined) {
            if (!/^\d{4}$/.test(yearValue)) {
                badRequest(
                    "year must be a four-digit calendar year."
                );
            }

            year = Number(yearValue);

            if (year < 1900 || year > 2099) {
                badRequest(
                    "year must be between 1900 and 2100."
                );
            }
        }

        // 6. Validate positive integer IDs.
        const parseId = (value, fieldName) => {
            if (value === undefined) {
                return undefined;
            }

            if (!/^[1-9]\d*$/.test(value)) {
                badRequest(
                    `${fieldName} must be a positive integer.`
                );
            }

            const parsed = Number(value);

            if (!Number.isSafeInteger(parsed)) {
                badRequest(
                    `${fieldName} is outside the valid integer range.`
                );
            }

            return parsed;
        };

        const departmentId = parseId(
            departmentValue,
            "departmentId"
        );

        const companyId = parseId(
            companyValue,
            "companyId"
        );

        // 7. Call service.
        const data = await getMonthlyAnalytics({
            academicYear,
            year,
            departmentId,
            companyId
        });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error("Monthly analytics error:", error);

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred."
        });
    }
};

const getDepartments = async (req, res) => {

    try {

        const allowedParams = [
            "academicYear",
            "departmentId"
        ];

        // Reject unknown query parameters
        const unknownParams = Object.keys(req.query).filter(
            (param) => !allowedParams.includes(param)
        );

        if (unknownParams.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid query parameter(s): ${unknownParams.join(", ")}`
            });
        }

        let { academicYear, departmentId } = req.query;

        // Validate academicYear
        if (academicYear !== undefined) {

            if (
                typeof academicYear !== "string" ||
                !/^\d{4}-\d{2}$/.test(academicYear)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "academicYear must be in YYYY-YY format"
                });
            }

            const [startYear, endYear] = academicYear.split("-").map(Number);

            if (
                endYear !== (startYear + 1) % 100 ||
                startYear < 1900 ||
                startYear > 2099
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid academic year"
                });
            }

        } else {

            // Default to the current academic year
            const today = new Date();

            const currentYear = today.getUTCFullYear();

            const startYear = today.getUTCMonth() >= 6
            ? currentYear
            : currentYear - 1;

            academicYear =
                `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
        }

        // Validate departmentId
        if (departmentId !== undefined) {

            if (
                typeof departmentId !== "string" ||
                !/^[1-9]\d*$/.test(departmentId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "departmentId must be a positive integer"
                });
            }

            departmentId = Number(departmentId);

            if (!Number.isSafeInteger(departmentId)) {
                return res.status(400).json({
                success: false,
                message: "departmentId must be a positive safe integer."
            });
}

        }

        const data = await getDepartmentsAnalytics({
            academicYear,
            departmentId
        });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {

    if (error instanceof ValidationError) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    console.error("Departments Analytics Error:", error);

    return res.status(500).json({
        success: false,
        message: "Failed to fetch department analytics"
    });

}
};


const getCompanies = async (req, res) => {
  try {
    const allowedParams = [
      "academicYear",
      "companyId",
      "departmentId",
    ];

    // Reject unsupported query parameters.
    const unknownParams = Object.keys(req.query).filter(
      (key) => !allowedParams.includes(key)
    );

    if (unknownParams.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown query parameter: ${unknownParams.join(", ")}`,
      });
    }

    const { academicYear, companyId, departmentId } = req.query;

    // Validate academic year.
    if (academicYear !== undefined) {
  if (
    typeof academicYear !== "string" ||
    !/^\d{4}-\d{2}$/.test(academicYear)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid academicYear. Use format YYYY-YY, e.g. 2026-27.",
    });
  }

  const [startYear, endYear] = academicYear.split("-").map(Number);

  if (
    startYear < 1900 ||
    startYear > 2099 ||
    endYear !== (startYear + 1) % 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid academicYear. The ending year must be the next year and the starting year must be between 1900 and 2099.",
    });
  }
}

    // Default to the current academic year (July-June).
    const now = new Date();
    const currentStartYear =
      now.getUTCMonth() >= 6
        ? now.getUTCFullYear()
        : now.getUTCFullYear() - 1;

    const selectedAcademicYear =
      academicYear ||
      `${currentStartYear}-${String((currentStartYear + 1) % 100).padStart(2, "0")}`;

    // Validate optional IDs.
    const validateId = (value) =>
      value === undefined ||
      (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value))
      );

    if (!validateId(companyId)) {
      return res.status(400).json({
        success: false,
        message: "companyId must be a positive integer.",
      });
    }

    if (!validateId(departmentId)) {
      return res.status(400).json({
        success: false,
        message: "departmentId must be a positive integer.",
      });
    }

    const data = await getCompaniesAnalytics({
      academicYear: selectedAcademicYear,
      companyId: companyId ? Number(companyId) : undefined,
      departmentId: departmentId ? Number(departmentId) : undefined,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Companies analytics error:", error);

  return res.status(500).json({
    success: false,
    message: "Failed to fetch company analytics.",
  });
}
};

const getYearly = async (req, res) => {
  try {
    // 1. Allow only supported query parameters.
    const allowedParams = [
      "fromYear",
      "toYear",
      "departmentId"
    ];

    const unknownParams = Object.keys(req.query).filter(
      (key) => !allowedParams.includes(key)
    );

    if (unknownParams.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported query parameter(s): ${unknownParams.join(", ")}`
      });
    }

    // 2. Read query parameters.
    const { fromYear, toYear, departmentId } = req.query;

    // 3. Check required parameters.
    if (!fromYear || !toYear) {
      return res.status(400).json({
        success: false,
        message: "Both fromYear and toYear are required."
      });
    }

    // 4. Validate academic year format.
    const academicYearRegex = /^(\d{4})-(\d{2})$/;

    const fromMatch = academicYearRegex.exec(fromYear);
    const toMatch = academicYearRegex.exec(toYear);

    if (
      typeof fromYear !== "string" ||
      typeof toYear !== "string" ||
      !fromMatch ||
      !toMatch
    ) {
      return res.status(400).json({
        success: false,
        message: "fromYear and toYear must follow YYYY-YY format, e.g. 2023-24."
      });
    }

    // 5. Validate academic year sequence.
    const fromStartYear = Number(fromMatch[1]);
    const fromEndYear = Number(fromMatch[2]);

    const toStartYear = Number(toMatch[1]);
    const toEndYear = Number(toMatch[2]);

    if (
      fromStartYear < 1900 ||
      fromStartYear > 2099 ||
      fromEndYear !== (fromStartYear + 1) % 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid fromYear. The ending year must be the next year."
      });
    }

    if (
      toStartYear < 1900 ||
      toStartYear > 2099 ||
      toEndYear !== (toStartYear + 1) % 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid toYear. The ending year must be the next year."
      });
    }

    // 6. Check that fromYear is not greater than toYear.
    if (fromStartYear > toStartYear) {
      return res.status(400).json({
        success: false,
        message: "fromYear cannot be greater than toYear."
      });
    }

    // 7. Validate optional departmentId.
    let parsedDepartmentId;

    if (departmentId !== undefined) {
      if (
        typeof departmentId !== "string" ||
        !/^[1-9]\d*$/.test(departmentId) ||
        !Number.isSafeInteger(Number(departmentId))
      ) {
        return res.status(400).json({
          success: false,
          message: "departmentId must be a positive integer."
        });
      }

      parsedDepartmentId = Number(departmentId);
    }

    // 8. Call the service function.
    const data = await getYearlyAnalytics({
      fromYear,
      toYear,
      departmentId: parsedDepartmentId
    });

    // 9. Return successful response.
    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Yearly analytics error:", error);

  return res.status(500).json({
    success: false,
    message: "Failed to fetch yearly analytics."
  });
}
};

module.exports = {
  getOverview,
  getMonthly,
  getDepartments,
  getCompanies,
  getYearly
};
