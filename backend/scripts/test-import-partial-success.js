
require("dotenv").config();

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BASE_URL =
    process.env.API_BASE_URL || "http://localhost:5000/api/v1";

const token = process.env.TPO_TOKEN;

function check(condition, message) {
    if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
    console.log(`PASS: ${message}`);
}

async function api(path, method = "GET") {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
}

async function main() {
    if (!token) throw new Error("TPO_TOKEN is not set.");

    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true },
    });
    if (!tpo) throw new Error("No TPO user found.");

    const department = await prisma.department.findFirst({
        select: { code: true },
    });
    if (!department) throw new Error("No department exists.");

    const suffix = `${Date.now()}${crypto.randomInt(100, 999)}`;

    const makeRow = (number) => ({
        PRN: `PART${suffix}${number}`,
        name: `Partial Import Test ${number}`,
        email: `partial.${suffix}.${number}@example.com`,
        departmentCode: department.code,
        graduationYear: 2027,
        academicPathway: "HSC",
        CGPA: 8.0,
        tenthPercentage: 85,
        twelfthPercentage: 82,
        activeBacklogs: 0,
    });

    const row1 = makeRow(1);
    const row2 = {
        ...makeRow(2),
        departmentCode: "__INVALID_TEST_DEPARTMENT__",
    };
    const row3 = makeRow(3);

    let batchId;

    try {
        const batch = await prisma.academicImportBatch.create({
            data: {
                fileName: `partial-success-${suffix}.csv`,
                importedByUserId: tpo.id,
                totalRows: 3,
                status: "PROCESSING",
                rows: {
                    create: [
                        {
                            rowNumber: 2,
                            PRN: row1.PRN,
                            rowData: row1,
                            status: "PENDING",
                        },
                        {
                            rowNumber: 3,
                            PRN: row2.PRN,
                            rowData: row2,
                            status: "PENDING",
                        },
                        {
                            rowNumber: 4,
                            PRN: row3.PRN,
                            rowData: row3,
                            status: "PENDING",
                        },
                    ],
                },
            },
            include: { rows: true },
        });

        batchId = batch.id;
        console.log("Test batch ID:", batchId);
        console.log("Test PRNs:", row1.PRN, row2.PRN, row3.PRN);

        // Process all three rows through the actual recovery endpoint.
        const result = await api(
            `/import/students/${batchId}/recover`,
            "POST"
        );

        console.log("Recovery HTTP status:", result.status);
        console.log("Recovery response:", result.body);

        check(result.status === 200, "Recovery endpoint returns HTTP 200");

        const finalBatch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
            include: {
                rows: { orderBy: { rowNumber: "asc" } },
            },
        });

        const expected = [
            { input: row1, status: "SUCCESS" },
            { input: row2, status: "FAILED" },
            { input: row3, status: "SUCCESS" },
        ];

        for (let i = 0; i < expected.length; i++) {
            const actual = finalBatch.rows[i];
            check(
                actual.status === expected[i].status,
                `Row ${i + 1} status is ${expected[i].status}`
            );
            check(
                actual.attemptCount === 1,
                `Row ${i + 1} was attempted exactly once`
            );
            check(
                actual.processingToken === null &&
                    actual.processingStartedAt === null,
                `Row ${i + 1} processing lease is released`
            );
        }

        check(
            finalBatch.status === "COMPLETED_WITH_ERRORS",
            "Batch status is COMPLETED_WITH_ERRORS"
        );
        check(finalBatch.totalRows === 3, "Batch total is 3");
        check(finalBatch.successfulRows === 2, "Successful count is 2");
        check(finalBatch.failedRows === 1, "Failed count is 1");
        check(
            finalBatch.processingToken === null &&
                finalBatch.processingStartedAt === null,
            "Batch processing lease is released"
        );
        check(
            finalBatch.rows[1].errorMessage?.includes(
                "__INVALID_TEST_DEPARTMENT__"
            ),
            "Invalid row has a meaningful validation error"
        );

        for (const input of [row1, row3]) {
            const users = await prisma.user.findMany({
                where: { email: input.email },
                select: { id: true },
            });
            const students = await prisma.student.findMany({
                where: { PRN: input.PRN },
                select: { id: true, userId: true },
            });

            check(users.length === 1, `${input.PRN}: exactly one user exists`);
            check(
                students.length === 1,
                `${input.PRN}: exactly one student exists`
            );
            check(
                finalBatch.rows.some(
                    (row) =>
                        row.PRN === input.PRN &&
                        row.studentId === students[0].id
                ),
                `${input.PRN}: import row references its student`
            );
        }

        const invalidUsers = await prisma.user.count({
            where: { email: row2.email },
        });
        const invalidStudents = await prisma.student.count({
            where: { PRN: row2.PRN },
        });

        check(invalidUsers === 0, "Invalid row created no user");
        check(invalidStudents === 0, "Invalid row created no student");

        console.log("\nSUCCESS: Partial-success test passed.");
        console.log("Final batch:", {
            id: finalBatch.id,
            status: finalBatch.status,
            totalRows: finalBatch.totalRows,
            successfulRows: finalBatch.successfulRows,
            failedRows: finalBatch.failedRows,
        });
    } catch (error) {
        console.error("\nTEST FAILED:", error.message);
        if (batchId) console.error("Inspect test batch ID:", batchId);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
