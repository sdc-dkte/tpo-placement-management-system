
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    console.log("Preparing a recovery test fixture...");

    // Use an existing TPO account as the batch owner.
    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true, email: true },
    });

    if (!tpo) {
        throw new Error("No TPO account found. No test batch was created.");
    }

    const staleTime = new Date(Date.now() - 16 * 60 * 1000);
    const fileName = `recovery-test-${Date.now()}.csv`;

    const batch = await prisma.academicImportBatch.create({
        data: {
            fileName,
            importedByUserId: tpo.id,
            totalRows: 1,
            status: "PROCESSING",
            rows: {
                create: {
                    rowNumber: 1,
                    PRN: `RECOVERY_TEST_${Date.now()}`,
                    status: "PROCESSING",
                    rowData: {},
                    attemptCount: 1,
                    processingToken: "recovery-test-stale-token",
                    processingStartedAt: staleTime,
                },
            },
        },
        include: {
            rows: {
                select: {
                    id: true,
                    rowNumber: true,
                    status: true,
                    processingStartedAt: true,
                    attemptCount: true,
                },
            },
        },
    });

    console.log("\nTest fixture created:");
    console.dir(
        {
            batchId: batch.id,
            fileName: batch.fileName,
            tpoEmail: tpo.email,
            rows: batch.rows,
        },
        { depth: null }
    );

    console.log(
        `\nNext, call POST /api/v1/import/students/${batch.id}/recover`
    );
}

main()
    .catch((error) => {
        console.error("Recovery test setup failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
