/**
 * Script to remove all student records and related student artifacts from the database.
 * Preserves TPO administrative users, departments, companies, and recruitment drives.
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function clearStudents() {
    console.log("Starting removal of all student records from database...");

    const beforeStudentCount = await prisma.student.count();
    const beforeUserCount = await prisma.user.count({ where: { role: "STUDENT" } });
    console.log(`Current state: ${beforeStudentCount} students, ${beforeUserCount} student user accounts.`);

    await prisma.$transaction(async (tx) => {
        // 1. Placement status histories tied to drive participations
        const deletedHistories = await tx.placementStatusHistory.deleteMany();
        console.log(`Deleted ${deletedHistories.count} placement status history records.`);

        // 2. Selections
        const deletedSelections = await tx.studentSelection.deleteMany();
        console.log(`Deleted ${deletedSelections.count} student selection records.`);

        // 3. Drive participations
        const deletedParticipations = await tx.driveParticipation.deleteMany();
        console.log(`Deleted ${deletedParticipations.count} drive participation records.`);

        // 4. Student documents
        const deletedDocuments = await tx.studentDocument.deleteMany();
        console.log(`Deleted ${deletedDocuments.count} student document records.`);

        // 5. Email campaign recipients
        const deletedRecipients = await tx.emailRecipient.deleteMany();
        console.log(`Deleted ${deletedRecipients.count} email campaign recipient records.`);

        // 6. Academic import rows
        const deletedImportRows = await tx.academicImportRow.deleteMany();
        console.log(`Deleted ${deletedImportRows.count} academic import rows.`);

        // 7. Academic import batches
        const deletedImportBatches = await tx.academicImportBatch.deleteMany();
        console.log(`Deleted ${deletedImportBatches.count} academic import batches.`);

        // 8. Student profiles
        const deletedStudents = await tx.student.deleteMany();
        console.log(`Deleted ${deletedStudents.count} student profiles.`);

        // 9. Student User accounts
        const deletedStudentUsers = await tx.user.deleteMany({
            where: { role: "STUDENT" },
        });
        console.log(`Deleted ${deletedStudentUsers.count} student user accounts.`);
    });

    const afterStudentCount = await prisma.student.count();
    const afterUserStudentCount = await prisma.user.count({ where: { role: "STUDENT" } });
    const tpoCount = await prisma.user.count({ where: { role: "TPO" } });

    console.log("\n--- Verification After Purge ---");
    console.log(`Students in DB: ${afterStudentCount} (Expected: 0)`);
    console.log(`Student Users in DB: ${afterUserStudentCount} (Expected: 0)`);
    console.log(`TPO Users in DB: ${tpoCount} (Preserved)`);

    if (afterStudentCount === 0 && afterUserStudentCount === 0 && tpoCount > 0) {
        console.log("✅ All student records successfully removed from the database!");
    } else {
        console.error("❌ Unexpected count mismatch after purge.");
        process.exit(1);
    }
}

clearStudents()
    .catch((err) => {
        console.error("Failed to clear students:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
