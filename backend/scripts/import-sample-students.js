/**
 * Script to import the updated 24-student sample data across all 8 DKTE engineering departments:
 * CSE, AIML, AIDS, ENTC, ELEC, MECH, CIVIL, TEXTILE.
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function importSampleData() {
    console.log("Loading updated sample data into the database...");

    const csvPath = path.join(__dirname, "../../sample-data/dkte_batch_2026_clean_testing.csv");
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    const header = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1);

    const departments = await prisma.department.findMany();
    const deptMap = new Map(departments.map((d) => [d.code, d.id]));

    const tpoUser = await prisma.user.findFirst({ where: { role: "TPO" } });
    if (!tpoUser) {
        throw new Error("No TPO user found in database. Run seed first.");
    }

    const defaultPasswordHash = await bcrypt.hash("DKTE@2026", 10);

    // Create batch record
    const batch = await prisma.academicImportBatch.create({
        data: {
            fileName: "dkte_batch_2026_clean_testing.csv",
            importedByUserId: tpoUser.id,
            status: "COMPLETED",
            totalRows: rows.length,
            successfulRows: rows.length,
            failedRows: 0,
            importedAt: new Date(),
            completedAt: new Date(),
        },
    });

    let importedCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const parts = rows[i].split(",").map((p) => p.trim());
        const [
            prn,
            name,
            email,
            deptCode,
            gradYear,
            pathway,
            cgpa,
            tenth,
            twelfth,
            diploma,
            backlogs,
        ] = parts;

        const deptId = deptMap.get(deptCode);
        if (!deptId) {
            console.warn(`Department code not found: ${deptCode} for PRN: ${prn}`);
            continue;
        }

        const user = await prisma.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                passwordHash: defaultPasswordHash,
                role: "STUDENT",
            },
        });

        const student = await prisma.student.create({
            data: {
                userId: user.id,
                PRN: prn,
                departmentId: deptId,
                graduationYear: parseInt(gradYear, 10),
                academicPathway: pathway,
                CGPA: cgpa ? parseFloat(cgpa) : null,
                tenthPercentage: tenth ? parseFloat(tenth) : null,
                twelfthPercentage: twelfth ? parseFloat(twelfth) : null,
                diplomaPercentage: diploma ? parseFloat(diploma) : null,
                activeBacklogs: backlogs ? parseInt(backlogs, 10) : 0,
            },
        });

        await prisma.academicImportRow.create({
            data: {
                batchId: batch.id,
                rowNumber: i + 2,
                PRN: prn,
                status: "SUCCESS",
                studentId: student.id,
                processedAt: new Date(),
            },
        });

        importedCount++;
    }

    console.log(`✅ Successfully imported ${importedCount} students across all 8 departments into the database!`);
}

importSampleData()
    .catch((err) => {
        console.error("Failed to import sample data:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
