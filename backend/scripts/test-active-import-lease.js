require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TOKEN = process.env.TPO_TOKEN;

async function main() {
    if (!TOKEN) {
        throw new Error("TPO_TOKEN is missing. Set your existing TPO JWT in PowerShell.");
    }

    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true, email: true },
    });

    if (!tpo) throw new Error("No TPO account found.");

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const prn = `STALE${unique.replace(/[^0-9]/g, "").slice(-12)}`;
    const email = `stale.test.${unique}@example.com`;

    // Make the batch lease 16 minutes old.
    const staleTime = new Date(Date.now() - 16 * 60 * 1000);
    const batchToken = `stale-batch-${unique}`;

    const batch = await prisma.academicImportBatch.create({
        data: {
            fileName: `stale-lease-test-${unique}.csv`,
            importedByUserId: tpo.id,
            totalRows: 1,
            status: "PROCESSING",
            processingToken: batchToken,
            processingStartedAt: staleTime,
            startedAt: staleTime,
            rows: {
                create: {
                    rowNumber: 1,
                    PRN: prn,
                    status: "PENDING",
                    attemptCount: 0,
                    rowData: {
                        PRN: prn,
                        name: "Stale Lease Test",
                        email,
                        departmentCode: "CSE",
                        graduationYear: "2027",
                        academicPathway: "HSC",
                        CGPA: "8.5",
                        tenthPercentage: "85",
                        twelfthPercentage: "82",
                        activeBacklogs: "0",
                    },
                },
            },
        },
        include: { rows: true },
    });

    console.log("Created stale batch:", batch.id);
    console.log("Stale lease timestamp:", staleTime.toISOString());
    console.log("Calling recovery endpoint...");

    const response = await fetch(
        `${BASE_URL}/import/students/${batch.id}/recover`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            },
        }
    );

    const body = await response.json().catch(() => ({}));

    const after = await prisma.academicImportBatch.findUnique({
        where: { id: batch.id },
        include: { rows: true },
    });

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
    });

    const row = after?.rows[0];

    const checks = [
        ["Recovery request returns HTTP 200", response.status === 200],
        ["Batch reaches COMPLETED", after?.status === "COMPLETED"],
        ["Batch lease is released", after?.processingToken == null],
        ["Row reaches SUCCESS", row?.status === "SUCCESS"],
        ["Row lease is released", row?.processingToken == null],
        ["Exactly one attempt was made", row?.attemptCount === 1],
        ["Student user was created", user?.role === "STUDENT"],
    ];

    console.log("\nAPI response:");
    console.log("HTTP status:", response.status);
    console.log(JSON.stringify(body, null, 2));

    console.log("\nDatabase verification:");
    for (const [label, passed] of checks) {
        console.log(`${passed ? "PASS" : "FAIL"} - ${label}`);
    }

    console.log("\nFinal batch state:", after?.status);
    console.log("Final row state:", row?.status);
    console.log("Batch ID:", batch.id);

    if (checks.every(([, passed]) => passed)) {
        console.log("\nALL CHECKS PASSED");
    } else {
        console.error("\nTEST FAILED - inspect the response and database state.");
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error("Test failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
