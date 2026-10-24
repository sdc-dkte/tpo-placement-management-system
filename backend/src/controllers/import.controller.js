
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { parse } = require("csv-parse/sync");
const prisma = require("../prismaClient");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
};

const generateTempPassword = () =>
    crypto.randomBytes(6).toString("base64url") + "#7";

const validateRow = (row, departmentsByCode) => {
    const PRN = (row.PRN || "").trim();
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    const departmentCode = (row.departmentCode || "").trim().toUpperCase();
    const pathway = (row.academicPathway || "").trim().toUpperCase();

    if (!PRN) return { error: "PRN is required." };
    if (!name) return { error: "Name is required.", PRN };
    if (!EMAIL_REGEX.test(email)) {
        return { error: "Valid email is required.", PRN };
    }

    const department = departmentsByCode.get(departmentCode);
    if (!department) {
        return { error: `Unknown department code "${departmentCode}".`, PRN };
    }

    const graduationYear = toNumber(row.graduationYear);
    if (
        !Number.isInteger(graduationYear) ||
        graduationYear < 2000 ||
        graduationYear > 2100
    ) {
        return { error: "Graduation year must be a valid year.", PRN };
    }

    if (!["HSC", "DIPLOMA"].includes(pathway)) {
        return { error: "academicPathway must be HSC or DIPLOMA.", PRN };
    }

    const CGPA = toNumber(row.CGPA);
    const tenthPercentage = toNumber(row.tenthPercentage);
    const twelfthPercentage = toNumber(row.twelfthPercentage);
    const diplomaPercentage = toNumber(row.diplomaPercentage);
    const activeBacklogs = toNumber(row.activeBacklogs) ?? 0;

    const inRange = (value, max) =>
        value === null ||
        (!Number.isNaN(value) && value >= 0 && value <= max);

    if (!inRange(CGPA, 10)) {
        return { error: "CGPA must be between 0 and 10.", PRN };
    }

    if (tenthPercentage === null || !inRange(tenthPercentage, 100)) {
        return { error: "Tenth percentage is required (0-100).", PRN };
    }

    if (!inRange(twelfthPercentage, 100)) {
        return {
            error: "Twelfth percentage must be between 0 and 100.",
            PRN,
        };
    }

    if (!inRange(diplomaPercentage, 100)) {
        return {
            error: "Diploma percentage must be between 0 and 100.",
            PRN,
        };
    }

    if (pathway === "HSC" && twelfthPercentage === null) {
        return {
            error: "Twelfth percentage is required for HSC pathway.",
            PRN,
        };
    }

    if (pathway === "DIPLOMA" && diplomaPercentage === null) {
        return {
            error: "Diploma percentage is required for DIPLOMA pathway.",
            PRN,
        };
    }

    if (!Number.isInteger(activeBacklogs) || activeBacklogs < 0) {
        return {
            error: "Active backlogs must be a non-negative integer.",
            PRN,
        };
    }

    return {
        data: {
            PRN,
            name,
            email,
            departmentId: department.id,
            graduationYear,
            academicPathway: pathway,
            CGPA,
            tenthPercentage,
            twelfthPercentage,
            diplomaPercentage,
            activeBacklogs,
        },
    };
};


const refreshBatchSummary = async (batchId, expectedToken) => {
    if (typeof expectedToken !== "string" || expectedToken.length === 0) {
        throw new Error(
            "Cannot refresh batch summary without a valid processing token."
        );
    }
    const rows = await prisma.academicImportRow.groupBy({
        by: ["status"],
        where: { batchId },
        _count: { _all: true },
    });

    const counts = Object.fromEntries(
        rows.map((item) => [item.status, item._count._all])
    );

    const successfulRows = counts.SUCCESS || 0;
    const failedRows = counts.FAILED || 0;
    const pendingRows = counts.PENDING || 0;
    const processingRows = counts.PROCESSING || 0;

    const batch = await prisma.academicImportBatch.findUniqueOrThrow({
        where: { id: batchId },
        select: {
            totalRows: true,
            processingToken: true,
        },
    });

    const finished =
        batch.totalRows > 0 &&
        successfulRows + failedRows === batch.totalRows &&
        pendingRows === 0 &&
        processingRows === 0;

    const status = !finished
        ? "PROCESSING"
        : failedRows > 0
            ? "COMPLETED_WITH_ERRORS"
            : "COMPLETED";

    // Update summary fields without changing the lease.
    const updated = await prisma.academicImportBatch.updateMany({
        where: {
            id: batchId,
            processingToken: expectedToken,
        },
        data: {
            successfulRows,
            failedRows,
            status,
            completedAt: finished ? new Date() : null,
        },
    });

    if (updated.count !== 1) {
        throw new Error(
            `Cannot refresh batch ${batchId}: processing lease was lost.`
        );
    }

    return {
        totalRows: batch.totalRows,
        successfulRows,
        failedRows,
        pendingRows,
        processingRows,
        status,
    };
};

const processImportRow = async (batchId, rowId, departmentsByCode) => {

    const processingToken = crypto.randomUUID();
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() - 15 * 60 * 1000);

    // Atomically claim a PENDING row or reclaim a PROCESSING row
    // whose lease has expired.
    const claim = await prisma.academicImportRow.updateMany({
        where: {
            id: rowId,
            batchId,
            OR: [
                {
                    status: "PENDING",
                },
                {
                    status: "PROCESSING",
                    processingStartedAt: {
                        lt: leaseExpiry,
                    },
                },
            ],
        },
        data: {
            status: "PROCESSING",
            processingToken,
            processingStartedAt: now,
            attemptCount: {
                increment: 1,
            },
            errorMessage: null,
        },
    });

    if (claim.count === 0) {
        return { skipped: true };
    }


    try {
        const row = await prisma.academicImportRow.findFirst({
            where: {
                id: rowId,
                batchId,
                status: "PROCESSING",
                processingToken,
            },
        });

        if (!row || !row.rowData) {
            throw new Error("Saved CSV row data is unavailable.");
        }

        const result = validateRow(row.rowData, departmentsByCode);

        if (result.error) {
            throw new Error(result.error);
        }

        const d = result.data;
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const student = await prisma.$transaction(async (tx) => {
            // Check ownership inside the transaction before creating the account.

            const ownedRows = await tx.$queryRaw`
                SELECT id
                FROM "AcademicImportRow"
                WHERE id = ${rowId}
                AND "batchId" = ${batchId}
                AND status = 'PROCESSING'::"ImportRowStatus"
                AND "processingToken" = ${processingToken}
                FOR UPDATE
            `;

            if (ownedRows.length === 0) {
                throw new Error("Import row ownership was lost.");
            }


            const [emailTaken, prnTaken] = await Promise.all([
                tx.user.findUnique({ where: { email: d.email } }),
                tx.student.findUnique({ where: { PRN: d.PRN } }),
            ]);

            if (emailTaken) {
                throw new Error("Email is already registered.");
            }

            if (prnTaken) {
                throw new Error("PRN is already registered.");
            }

            const user = await tx.user.create({
                data: {
                    name: d.name,
                    email: d.email,
                    passwordHash,
                    role: "STUDENT",
                },
            });

            const createdStudent = await tx.student.create({
                data: {
                    userId: user.id,
                    PRN: d.PRN,
                    departmentId: d.departmentId,
                    graduationYear: d.graduationYear,
                    academicPathway: d.academicPathway,
                    CGPA: d.CGPA,
                    tenthPercentage: d.tenthPercentage,
                    twelfthPercentage: d.twelfthPercentage,
                    diplomaPercentage: d.diplomaPercentage,
                    activeBacklogs: d.activeBacklogs,
                },
            });

            // Success log and student creation commit together.
            const updated = await tx.academicImportRow.updateMany({
                where: {
                    id: rowId,
                    batchId,
                    status: "PROCESSING",
                    processingToken,
                },
                data: {
                    status: "SUCCESS",
                    PRN: d.PRN,
                    studentId: createdStudent.id,
                    errorMessage: null,
                    processedAt: new Date(),
                    processingToken: null,
                    processingStartedAt: null,
                },
            });

            if (updated.count !== 1) {
                throw new Error("Could not finalize import row ownership.");
            }

            return createdStudent;
        });

        return {
            success: true,
            studentId: student.id,
            credentials: {
                PRN: d.PRN,
                name: d.name,
                email: d.email,
                temporaryPassword: tempPassword,
            },
        };
    } catch (error) {
        const message =
            error.code === "P2002"
                ? "Email or PRN is already registered."
                : error.message || "Unable to process this row.";

        // Only the current owner may mark this row failed.

        const failedUpdate = await prisma.academicImportRow.updateMany({
            where: {
                id: rowId,
                batchId,
                status: "PROCESSING",
                processingToken,
            },
            data: {
                status: "FAILED",
                errorMessage: message,
                processedAt: new Date(),
                processingToken: null,
                processingStartedAt: null,
            },
        });

        if (failedUpdate.count !== 1) {
            return {
                skipped: true,
                lostOwnership: true,
            };
        }

        return { success: false, error: message };

    }
};

const importStudents = async (req, res) => {
    let batchId;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a CSV file in the 'file' field.",
            });
        }

        let records;

        try {
            records = parse(req.file.buffer, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: `Invalid CSV file: ${error.message}`,
            });
        }

        if (records.length === 0) {
            return res.status(400).json({
                success: false,
                message: "The CSV file has no data rows.",
            });
        }

        const departments = await prisma.department.findMany();
        const departmentsByCode = new Map(
            departments.map((department) => [
                department.code.toUpperCase(),
                department,
            ])
        );

        // Validate required headers before creating the batch.
        const requiredHeaders = [
            "PRN",
            "name",
            "email",
            "departmentCode",
            "graduationYear",
            "academicPathway",
            "CGPA",
            "tenthPercentage",
            "twelfthPercentage",
            "diplomaPercentage",
            "activeBacklogs",
        ];

        const headers = Object.keys(records[0]);
        const missingHeaders = requiredHeaders.filter(
            (header) => !headers.includes(header)
        );

        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: "CSV is missing required columns.",
                missingHeaders,
            });
        }

        // Persist the batch and every source row before processing.

        const batchProcessingToken = crypto.randomUUID();

        const batch = await prisma.academicImportBatch.create({
            data: {
                fileName: req.file.originalname,
                importedByUserId: req.user.id,
                totalRows: records.length,
                status: "PROCESSING",
                processingToken: batchProcessingToken,
                processingStartedAt: new Date(),
                rows: {
                    create: records.map((record, index) => ({
                        rowNumber: index + 1,
                        PRN: (record.PRN || "").trim() || null,
                        status: "PENDING",
                        rowData: record,
                    })),
                },
            },
            include: {
                rows: {
                    select: {
                        id: true,
                        rowNumber: true,
                    },
                },
            },
        });



        batchId = batch.id;
        const credentials = [];

        for (const row of batch.rows) {
            const result = await processImportRow(
                batch.id,
                row.id,
                departmentsByCode
            );

            if (result.credentials) {
                credentials.push(result.credentials);
            }
        }

        const summary = await refreshBatchSummary(batch.id, batchProcessingToken);

        const released = await prisma.academicImportBatch.updateMany({
            where: {
                id: batch.id,
                processingToken: batchProcessingToken,
            },
            data: {
                processingToken: null,
                processingStartedAt: null,
            },
        });

        if (released.count !== 1) {
            throw new Error(
                "Import batch lease was lost before completion."
            );
        }

        const failedRows = await prisma.academicImportRow.findMany({
            where: {
                batchId: batch.id,
                status: "FAILED",
            },
            select: {
                rowNumber: true,
                PRN: true,
                errorMessage: true,
            },
            orderBy: { rowNumber: "asc" },
        });

        return res.status(200).json({
            success: true,
            message: `Import finished: ${summary.successfulRows} registered, ${summary.failedRows} failed.`,
            batchId: batch.id,
            ...summary,
            errors: failedRows.map((row) => ({
                rowNumber: row.rowNumber,
                PRN: row.PRN,
                message: row.errorMessage,
            })),
            credentials,
        });
    } catch (error) {
        console.error("Student import error:", error);

        // If a batch exists, preserve its persisted row state.
        // A later recovery action can inspect and resume unfinished rows.
        if (batchId && recoveryToken) {
            try {
                await refreshBatchSummary(batchId, recoveryToken);

                const released = await prisma.academicImportBatch.updateMany({
                    where: {
                        id: batchId,
                        importedByUserId: req.user.id,
                        processingToken: recoveryToken,
                    },
                    data: {
                        processingToken: null,
                        processingStartedAt: null,
                    },
                });

                if (released.count !== 1) {
                    console.warn(
                        `Recovery batch ${batchId}: lease was not released because ownership changed.`
                    );
                }
            } catch (summaryError) {
                console.error(
                    "Unable to refresh or clean up recovery batch:",
                    summaryError
                );
            }
        }

        return res.status(500).json({
            success: false,
            message: "An internal server error occurred.",
            ...(batchId ? { batchId } : {}),
        });
    }
};


async function getImportBatchStatus(req, res) {
    try {
        const batchId = Number(req.params.batchId);

        if (!Number.isSafeInteger(batchId) || batchId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid import batch ID.",
            });
        }

        const batch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            select: {
                id: true,
                fileName: true,
                status: true,
                totalRows: true,
                successfulRows: true,
                failedRows: true,
                importedAt: true,
                startedAt: true,
                completedAt: true,
                rows: {
                    where: { status: "FAILED" },
                    select: {
                        rowNumber: true,
                        PRN: true,
                        status: true,
                        errorMessage: true,
                        attemptCount: true,
                        processedAt: true,
                    },
                    orderBy: { rowNumber: "asc" },
                },
            },
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Import batch not found.",
            });
        }

        // A batch should only be visible to its authorized importing TPO.
        const importedBy = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            select: { importedByUserId: true },
        });

        if (importedBy?.importedByUserId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to view this import batch.",
            });
        }

        return res.status(200).json({
            success: true,
            batch: {
                id: batch.id,
                fileName: batch.fileName,
                status: batch.status,
                totalRows: batch.totalRows,
                successfulRows: batch.successfulRows,
                failedRows: batch.failedRows,
                importedAt: batch.importedAt,
                startedAt: batch.startedAt,
                completedAt: batch.completedAt,
            },
            failedRows: batch.rows,
        });
    } catch (error) {
        console.error("Get import batch status error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve import batch status.",
        });
    }
}


async function retryImportBatch(req, res) {
    let batchId;
    let retryToken;

    try {
        batchId = Number(req.params.batchId);

        if (!Number.isSafeInteger(batchId) || batchId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid import batch ID.",
            });
        }

        const batch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            select: {
                id: true,
                importedByUserId: true,
                status: true,
            },
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Import batch not found.",
            });
        }

        if (batch.importedByUserId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to retry this batch.",
            });
        }

        // Do not start another retry while this batch is active.
        if (batch.status === "PROCESSING") {
            return res.status(409).json({
                success: false,
                message: "This batch is already being processed.",
            });
        }

        const departments = await prisma.department.findMany({
            select: { id: true, code: true },
        });

        const departmentsByCode = new Map(
            departments.map((department) => [
                department.code.trim().toUpperCase(),
                department,
            ])
        );

        const failedRows = await prisma.academicImportRow.findMany({
            where: {
                batchId,
                status: "FAILED",
                rowData: { not: null },
            },
            select: { id: true },
            orderBy: { rowNumber: "asc" },
        });

        if (failedRows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "There are no retryable failed rows in this batch.",
            });
        }

        // Atomically claim the batch to prevent concurrent retry requests.
        retryToken = crypto.randomUUID();
        const retryStartedAt = new Date();

        const claimed = await prisma.academicImportBatch.updateMany({
            where: {
                id: batchId,
                importedByUserId: req.user.id,
                status: { not: "PROCESSING" },
                processingToken: null,
            },
            data: {
                status: "PROCESSING",
                processingToken: retryToken,
                processingStartedAt: retryStartedAt,
                startedAt: retryStartedAt,
                completedAt: null,
            },
        });

        if (claimed.count !== 1) {
            return res.status(409).json({
                success: false,
                message: "This batch has already been claimed for processing.",
            });
        }


        const resetResult = await prisma.academicImportRow.updateMany({
            where: {
                batchId,
                id: { in: failedRows.map((row) => row.id) },
                status: "FAILED",
                rowData: { not: null },
            },
            data: {
                status: "PENDING",
                processingToken: null,
                processingStartedAt: null,
                errorMessage: null,
                processedAt: null,
            },
        });

        if (resetResult.count !== failedRows.length) {
            await refreshBatchSummary(batchId, retryToken);

            const released = await prisma.academicImportBatch.updateMany({
                where: {
                    id: batchId,
                    importedByUserId: req.user.id,
                    processingToken: retryToken,
                },
                data: {
                    processingToken: null,
                    processingStartedAt: null,
                },
            });

            if (released.count !== 1) {
                console.error(
                    `Could not release retry lease for batch ${batchId}.`
                );
            }

            return res.status(409).json({
                success: false,
                message:
                    "Some failed rows changed before retry could begin. Refresh the batch status and try again.",
            });
        }



        let retried = 0;
        let skipped = 0;

        for (const row of failedRows) {
            const result = await processImportRow(
                batchId,
                row.id,
                departmentsByCode
            );

            if (result?.skipped) {
                skipped++;
            } else {
                retried++;
            }
        }


        await refreshBatchSummary(batchId, retryToken);

        const released = await prisma.academicImportBatch.updateMany({
            where: {
                id: batchId,
                importedByUserId: req.user.id,
                processingToken: retryToken,
            },
            data: {
                processingToken: null,
                processingStartedAt: null,
            },
        });

        if (released.count !== 1) {
            throw new Error("Retry batch lease was lost before completion.");
        }

        const updatedBatch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            select: {
                id: true,
                status: true,
                totalRows: true,
                successfulRows: true,
                failedRows: true,
            },
        });



        return res.status(200).json({
            success: true,
            message: "Retry processing finished.",
            retriedRows: retried,
            skippedRows: skipped,
            batch: updatedBatch,
        });

    } catch (error) {
        console.error("Retry import batch error:", error);


        if (batchId) {
            try {
                await refreshBatchSummary(batchId, retryToken);

                const released = await prisma.academicImportBatch.updateMany({
                    where: {
                        id: batchId,
                        importedByUserId: req.user.id,
                        processingToken: retryToken,
                    },
                    data: {
                        processingToken: null,
                        processingStartedAt: null,
                    },
                });

                if (released.count !== 1) {
                    console.warn(
                        `Retry batch ${batchId}: lease was not released because ownership changed.`
                    );
                }
            } catch (summaryError) {
                console.error(
                    "Unable to refresh or clean up retry batch:",
                    summaryError
                );
            }
        }


        return res.status(500).json({
            success: false,
            message: "Unable to retry this import batch.",
            batchId: batchId || undefined,
        });
    }
}


async function recoverImportBatch(req, res) {
    let batchId;
    let recoveryToken;

    try {
        batchId = Number(req.params.batchId);

        if (!Number.isSafeInteger(batchId) || batchId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid import batch ID.",
            });
        }

        const batch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            select: {
                id: true,
                importedByUserId: true,
                status: true,
                totalRows: true,
                processingToken: true,
                processingStartedAt: true,
            },
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: "Import batch not found.",
            });
        }

        if (batch.importedByUserId !== req.user?.id) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to recover this batch.",
            });
        }

        if (
            batch.status === "COMPLETED" ||
            batch.status === "COMPLETED_WITH_ERRORS"
        ) {
            return res.status(409).json({
                success: false,
                message: "This batch is already completed. Use retry for failed rows.",
            });
        }

        // Atomically claim the batch before attempting recovery.

        // Only reclaim rows whose processing lease is older than 15 minutes.


        const cutoff = new Date(Date.now() - 15 * 60 * 1000);
        recoveryToken = crypto.randomUUID();
        const recoveryStartedAt = new Date();

        // Claim only a batch that is stale or has no active lease.
        const claimConditions = [
            {
                processingToken: null,
                OR: [
                    { processingStartedAt: null },
                    { processingStartedAt: { lt: cutoff } },
                ],
            },
            {
                processingToken: { not: null },
                processingStartedAt: { lt: cutoff },
            },
        ];

        const claimed = await prisma.academicImportBatch.updateMany({
            where: {
                id: batchId,
                importedByUserId: req.user.id,
                status: "PROCESSING",
                OR: claimConditions,
            },
            data: {
                processingToken: recoveryToken,
                processingStartedAt: recoveryStartedAt,
                startedAt: recoveryStartedAt,
            },
        });

        if (claimed.count !== 1) {
            return res.status(409).json({
                success: false,
                message:
                    "This batch is not eligible for recovery or is already claimed. Refresh its status and try again.",
            });
        }

        const reclaimed = await prisma.academicImportRow.updateMany({
            where: {
                batchId,
                status: "PROCESSING",
                processingStartedAt: { lt: cutoff },
            },
            data: {
                status: "PENDING",
                processingToken: null,
                processingStartedAt: null,
                errorMessage:
                    "Recovered after an interrupted processing attempt.",
            },
        });

        const departments = await prisma.department.findMany({
            select: { id: true, code: true },
        });

        const departmentsByCode = new Map(
            departments.map((department) => [
                department.code.trim().toUpperCase(),
                department,
            ])
        );


        const pendingRows = await prisma.academicImportRow.findMany({
            where: {
                batchId,
                status: "PENDING",
            },
            select: {
                id: true,
            },
            orderBy: {
                id: "asc",
            },
        });




        let processedRows = 0;
        let skippedRows = 0;

        for (const row of pendingRows) {
            const result = await processImportRow(
                batchId,
                row.id,
                departmentsByCode
            );

            if (result?.success === true || result?.success === false) {
                processedRows++;
            } else {
                skippedRows++;
            }
        }

        const summary = await refreshBatchSummary(batchId, recoveryToken);

        const released = await prisma.academicImportBatch.updateMany({
            where: {
                id: batchId,
                importedByUserId: req.user.id,
                processingToken: recoveryToken,
            },
            data: {
                processingToken: null,
                processingStartedAt: null,
            },
        });

        if (released.count !== 1) {
            throw new Error(
                "Recovery batch lease was lost before completion."
            );
        }

        return res.status(200).json({
            success: true,
            message: "Import recovery attempt finished.",
            reclaimedRows: reclaimed.count,
            processedRows,
            skippedRows,
            batch: summary,
        });

    } catch (error) {
        console.error("Recover import batch error:", error);


        if (batchId) {
            try {
                await refreshBatchSummary(batchId, recoveryToken);

                if (typeof recoveryToken !== "undefined" && recoveryToken) {
                    const released = await prisma.academicImportBatch.updateMany({
                        where: {
                            id: batchId,
                            importedByUserId: req.user.id,
                            processingToken: recoveryToken,
                        },
                        data: {
                            processingToken: null,
                            processingStartedAt: null,
                        },
                    });

                    if (released.count !== 1) {
                        console.warn(
                            `Recovery batch ${batchId}: lease was not released because ownership changed.`
                        );
                    }
                }
            } catch (summaryError) {
                console.error(
                    "Unable to refresh or clean up recovery batch:",
                    summaryError
                );
            }
        }


        return res.status(500).json({
            success: false,
            message: "Unable to recover this import batch.",
        });
    }

}




module.exports = {
    importStudents,
    getImportBatchStatus,
    retryImportBatch,
    recoverImportBatch
};
