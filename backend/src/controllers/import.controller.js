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

// Returns { error } or { data }
const validateRow = (row, departmentsByCode) => {
    const PRN = (row.PRN || "").trim();
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    const departmentCode = (row.departmentCode || "").trim().toUpperCase();
    const pathway = (row.academicPathway || "").trim().toUpperCase();

    if (!PRN) return { error: "PRN is required." };
    if (!name) return { error: "Name is required.", PRN };
    if (!EMAIL_REGEX.test(email)) return { error: "Valid email is required.", PRN };

    const department = departmentsByCode.get(departmentCode);
    if (!department) {
        return { error: `Unknown department code "${departmentCode}".`, PRN };
    }

    const graduationYear = toNumber(row.graduationYear);
    if (!Number.isInteger(graduationYear) || graduationYear < 2000 || graduationYear > 2100) {
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

    const inRange = (v, max) => v === null || (!Number.isNaN(v) && v >= 0 && v <= max);

    if (!inRange(CGPA, 10)) return { error: "CGPA must be between 0 and 10.", PRN };
    if (tenthPercentage === null || !inRange(tenthPercentage, 100)) {
        return { error: "Tenth percentage is required (0-100).", PRN };
    }
    if (!inRange(twelfthPercentage, 100)) {
        return { error: "Twelfth percentage must be between 0 and 100.", PRN };
    }
    if (!inRange(diplomaPercentage, 100)) {
        return { error: "Diploma percentage must be between 0 and 100.", PRN };
    }
    if (pathway === "HSC" && twelfthPercentage === null) {
        return { error: "Twelfth percentage is required for HSC pathway.", PRN };
    }
    if (pathway === "DIPLOMA" && diplomaPercentage === null) {
        return { error: "Diploma percentage is required for DIPLOMA pathway.", PRN };
    }
    if (!Number.isInteger(activeBacklogs) || activeBacklogs < 0) {
        return { error: "Active backlogs must be a non-negative integer.", PRN };
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

const importStudents = async (req, res) => {
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
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                message: `Invalid CSV file: ${parseError.message}`,
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
            departments.map((d) => [d.code.toUpperCase(), d])
        );

        const batch = await prisma.academicImportBatch.create({
            data: {
                fileName: req.file.originalname,
                importedByUserId: req.user.id,
                totalRows: records.length,
            },
        });

        const rowLogs = [];
        const credentials = [];
        let successfulRows = 0;
        let failedRows = 0;

        for (let i = 0; i < records.length; i++) {
            const rowNumber = i + 1;
            const record = records[i];
            const rawPRN = (record.PRN || "").trim() || null;

            try {
                const result = validateRow(record, departmentsByCode);
                if (result.error) throw new Error(result.error);

                const d = result.data;

                const [emailTaken, prnTaken] = await Promise.all([
                    prisma.user.findUnique({ where: { email: d.email } }),
                    prisma.student.findUnique({ where: { PRN: d.PRN } }),
                ]);
                if (emailTaken) throw new Error("Email is already registered.");
                if (prnTaken) throw new Error("PRN is already registered.");

                const tempPassword = generateTempPassword();
                const passwordHash = await bcrypt.hash(tempPassword, 10);

                const student = await prisma.$transaction(async (tx) => {
                    const user = await tx.user.create({
                        data: {
                            name: d.name,
                            email: d.email,
                            passwordHash,
                            role: "STUDENT",
                        },
                    });

                    return tx.student.create({
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
                });

                successfulRows++;
                credentials.push({
                    PRN: d.PRN,
                    name: d.name,
                    email: d.email,
                    temporaryPassword: tempPassword,
                });
                rowLogs.push({
                    batchId: batch.id,
                    rowNumber,
                    PRN: d.PRN,
                    status: "SUCCESS",
                    studentId: student.id,
                });
            } catch (rowError) {
                failedRows++;
                rowLogs.push({
                    batchId: batch.id,
                    rowNumber,
                    PRN: rawPRN,
                    status: "FAILED",
                    errorMessage: rowError.message,
                });
            }
        }

        await prisma.academicImportRow.createMany({ data: rowLogs });
        await prisma.academicImportBatch.update({
            where: { id: batch.id },
            data: { successfulRows, failedRows },
        });

        const errors = rowLogs
            .filter((r) => r.status === "FAILED")
            .map((r) => ({
                rowNumber: r.rowNumber,
                PRN: r.PRN,
                message: r.errorMessage,
            }));

        return res.status(200).json({
            success: true,
            message: `Import finished: ${successfulRows} registered, ${failedRows} failed.`,
            batchId: batch.id,
            totalRows: records.length,
            successfulRows,
            failedRows,
            errors,
            credentials, // shown once; passwords are not stored in plain text
        });
    } catch (error) {
        console.error("Student import error:", error);
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred.",
        });
    }
};

module.exports = { importStudents };