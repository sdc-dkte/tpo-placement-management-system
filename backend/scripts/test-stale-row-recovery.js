require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TOKEN = process.env.TPO_TOKEN;

async function main() {
    if (!TOKEN) throw new Error("TPO_TOKEN is missing.");

    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true },
    });
    if (!tpo) throw new Error("No TPO account found.");

    const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const prn = `STALE${unique.replace(/[^0-9]/g, "").slice(-12)}`;
    const email = `stale.row.${unique}@example.com`;
    const staleTime = new Date(Date.now() - 16 * 60 * 1000);

    const batch = await prisma.academicImportBatch.create({
        data: {
            fileName: `stale-row-test-${unique}.csv`,
            importedByUserId: tpo.id,
            totalRows: 1,
            status: "PROCESSING",
            processingToken: `stale-batch-${unique}`,
            processingStartedAt: staleTime,
            startedAt: staleTime,
            rows: {
                create: {
                    rowNumber: 1,
                    PRN: prn,
                    status: "PROCESSING",
                    attemptCount: 1,
                    processingToken: `stale-row-${unique}`,
                    processingStartedAt: staleTime,
                    rowData: {
                        PRN: prn,
                        name: "Stale Row Recovery Test",
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

    console.log("Created batch:", batch.id);
    console.log("Batch and row leases are 16 minutes old.");

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
        ["HTTP 200", response.status === 200],
        ["One stale row reclaimed", body.reclaimedRows === 1],
        ["One row processed", body.processedRows === 1],
        ["Batch COMPLETED", after?.status === "COMPLETED"],
        ["Row SUCCESS", row?.status === "SUCCESS"],
        ["Attempt count increased to 2", row?.attemptCount === 2],
        ["Batch lease released", after?.processingToken == null],
        ["Row lease released", row?.processingToken == null],
        ["Student user created", user?.role === "STUDENT"],
    ];

    console.log("\nHTTP status:", response.status);
    console.log("API response:", JSON.stringify(body, null, 2));
    console.log("\nVerification:");
    for (const [label, pass] of checks) {
        console.log(`${pass ? "PASS" : "FAIL"} - ${label}`);
    }
    console.log("\nBatch ID:", batch.id);

    if (checks.every(([, pass]) => pass)) {
        console.log("\nALL CHECKS PASSED");
    } else {
        console.error("\nTEST FAILED");
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
