require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();
const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TOKEN = process.env.TPO_TOKEN;

async function main() {
    if (!TOKEN) {
        throw new Error(
            "Set the TPO_TOKEN environment variable before running this test."
        );
    }

    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true, email: true },
    });

    if (!tpo) throw new Error("No TPO account found.");

    const department = await prisma.department.findUnique({
        where: { code: "CSE" },
        select: { id: true },
    });

    if (!department) throw new Error("CSE department not found.");

    const suffix = `${Date.now()}${crypto.randomInt(100, 999)}`;
    const PRN = `RACE${suffix}`;
    const email = `race.test.${suffix}@example.com`;

    const rowData = {
        PRN,
        name: "Concurrent Recovery Test",
        email,
        departmentCode: "CSE",
        graduationYear: "2027",
        academicPathway: "HSC",
        CGPA: "8.5",
        tenthPercentage: "85",
        twelfthPercentage: "82",
        diplomaPercentage: "",
        activeBacklogs: "0",
    };

    const batch = await prisma.academicImportBatch.create({
        data: {
            fileName: `concurrency-test-${suffix}.csv`,
            importedByUserId: tpo.id,
            totalRows: 1,
            status: "PROCESSING",
            processingToken: null,
            processingStartedAt: null,
            rows: {
                create: {
                    rowNumber: 1,
                    PRN,
                    status: "PENDING",
                    rowData,
                },
            },
        },
        include: { rows: { select: { id: true } } },
    });

    const url = `${BASE_URL}/import/students/${batch.id}/recover`;
    const options = {
        method: "POST",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
    };

    console.log("Created test batch:", batch.id);
    console.log("Created test row:", batch.rows[0].id);
    console.log("Sending two concurrent recovery requests...");

    const responses = await Promise.all(
        [1, 2].map(async (requestNumber) => {
            try {
                const response = await fetch(url, options);
                const body = await response.text();

                console.log(`Request ${requestNumber}: HTTP ${response.status}`);
                console.log(body);

                return { status: response.status, body };
            } catch (error) {
                console.error(`Request ${requestNumber} failed:`, error.message);
                return { status: 0, body: error.message };
            }
        })
    );

    const results = await prisma.academicImportBatch.findUnique({
        where: { id: batch.id },
        include: { rows: true },
    });

    const user = await prisma.user.findUnique({
        where: { email },
        include: { studentProfile: true },
    });

    console.log("\nFinal database verification:");
    console.log(JSON.stringify({
        batchId: batch.id,
        statuses: responses.map(r => r.status),
        oneSuccessOneConflict:
            responses.some(r => r.status === 200) &&
            responses.some(r => r.status === 409),
        batch: results && {
            status: results.status,
            totalRows: results.totalRows,
            successfulRows: results.successfulRows,
            failedRows: results.failedRows,
            processingToken: results.processingToken,
        },
        rows: results?.rows.map(row => ({
            id: row.id,
            status: row.status,
            attemptCount: row.attemptCount,
            processingToken: row.processingToken,
            errorMessage: row.errorMessage,
        })),
        userCreated: Boolean(user),
        studentCreated: Boolean(user?.studentProfile),
        PRN,
        email,
    }, null, 2));
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
