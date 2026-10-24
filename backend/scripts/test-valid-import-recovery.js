require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
    const tpo = await prisma.user.findFirst({
        where: { role: "TPO" },
        select: { id: true, email: true },
    });

    if (!tpo) {
        throw new Error("No TPO account found. Cannot create test batch.");
    }

    const department = await prisma.department.findUnique({
        where: { code: "CSE" },
        select: { id: true, code: true },
    });

    if (!department) {
        throw new Error("CSE department not found.");
    }

    const suffix = `${Date.now()}${crypto.randomInt(100, 999)}`;
    const PRN = `TEST${suffix}`;
    const email = `import.test.${suffix}@example.com`;

    const rowData = {
        PRN,
        name: "Import Recovery Test",
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
            fileName: `recovery-test-${suffix}.csv`,
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
        include: {
            rows: { select: { id: true, status: true } },
        },
    });

    console.log(JSON.stringify({
        message: "Test batch and valid pending row created.",
        batchId: batch.id,
        rowId: batch.rows[0].id,
        rowStatus: batch.rows[0].status,
        tpoEmail: tpo.email,
        PRN,
        email,
        endpoint: `POST /api/v1/import/students/${batch.id}/recover`,
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
