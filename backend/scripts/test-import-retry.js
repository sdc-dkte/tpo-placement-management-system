
require("dotenv").config();

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE_URL =
    process.env.API_BASE_URL || "http://localhost:5000/api/v1";

const token = process.env.TPO_TOKEN;

function assert(condition, message) {
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
    const PRN = `RETRY${suffix}`;
    const email = `retry.test.${suffix}@example.com`;

    const validRow = {
        PRN,
        name: "Import Retry Test",
        email,
        departmentCode: department.code,
        graduationYear: 2027,
        academicPathway: "HSC",
        CGPA: 8.0,
        tenthPercentage: 85,
        twelfthPercentage: 82,
        activeBacklogs: 0,
    };

    let batchId;

    try {
        // Start with an invalid department to produce a real validation failure.
        const batch = await prisma.academicImportBatch.create({
            data: {
                fileName: `retry-test-${suffix}.csv`,
                importedByUserId: tpo.id,
                totalRows: 1,
                status: "PROCESSING",
                rows: {
                    create: {
                        rowNumber: 2,
                        PRN,
                        status: "PENDING",
                        rowData: {
                            ...validRow,
                            departmentCode: "__INVALID_TEST_DEPARTMENT__",
                        },
                    },
                },
            },
            include: { rows: true },
        });

        batchId = batch.id;
        console.log("Test batch ID:", batchId);
        console.log("Test PRN:", PRN);

        // Trigger normal row processing through the recovery endpoint.
        const recovery = await api(
            `/import/students/${batchId}/recover`,
            "POST"
        );

        console.log("Recovery HTTP status:", recovery.status);
        console.log("Recovery response:", recovery.body);

        let row = await prisma.academicImportRow.findFirst({
            where: { batchId },
        });

        let currentBatch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
        });

        assert(row.status === "FAILED", "Invalid row becomes FAILED");
        assert(
            row.errorMessage?.includes("__INVALID_TEST_DEPARTMENT__"),
            "Failure records the department validation error"
        );
        assert(
            currentBatch.status === "COMPLETED_WITH_ERRORS",
            "Batch becomes COMPLETED_WITH_ERRORS"
        );
        assert(row.attemptCount === 1, "First processing attempt is counted");

        // Fix only the invalid input, preserving the same test row.
        await prisma.academicImportRow.update({
            where: { id: row.id },
            data: { rowData: validRow },
        });

        const retry = await api(
            `/import/students/${batchId}/retry`,
            "POST"
        );

        console.log("Retry HTTP status:", retry.status);
        console.log("Retry response:", retry.body);

        assert(retry.status === 200, "Retry endpoint returns HTTP 200");

        row = await prisma.academicImportRow.findUnique({
            where: { id: row.id },
        });

        currentBatch = await prisma.academicImportBatch.findUnique({
            where: { id: batchId },
        });

        const users = await prisma.user.findMany({
            where: { email },
            select: { id: true, email: true, role: true },
        });

        const students = await prisma.student.findMany({
            where: { PRN },
            select: { id: true, PRN: true, userId: true },
        });

        assert(row.status === "SUCCESS", "Retried row becomes SUCCESS");
        assert(row.attemptCount === 2, "Retry increments attemptCount to 2");
        assert(row.errorMessage === null, "Previous error is cleared");
        assert(row.processingToken === null, "Row processing token is released");
        assert(
            row.processingStartedAt === null,
            "Row processing timestamp is cleared"
        );
        assert(currentBatch.status === "COMPLETED", "Batch becomes COMPLETED");
        assert(currentBatch.processingToken === null, "Batch token is released");
        assert(
            currentBatch.processingStartedAt === null,
            "Batch processing timestamp is cleared"
        );
        assert(users.length === 1, "Exactly one user exists for the test email");
        assert(students.length === 1, "Exactly one student exists for the test PRN");
        assert(
            row.studentId === students[0].id,
            "Import row references the created student"
        );

        console.log("\nSUCCESS: Failure-and-retry test passed.");
        console.log("Batch ID:", batchId);
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
