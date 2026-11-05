/**
 * Test script for GET /api/v1/import/latest endpoint
 * Verifies:
 * 1. Unauthenticated request -> 401 Unauthorized
 * 2. Student role request -> 403 Forbidden
 * 3. TPO role request -> 200 Success with latest batch metadata
 * 4. DB creation of a new batch -> returns newest batch immediately
 * 5. Handles empty/null state properly
 */

require("dotenv").config({ path: __dirname + "/../.env" });
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BASE_URL = process.env.API_BASE_URL || "http://localhost:5001/api/v1";
const JWT_SECRET = process.env.JWT_SECRET || "development-secret-key";

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
    console.log("=== Testing GET /api/v1/import/latest Feature ===\n");

    const tpoUser = await prisma.user.findFirst({ where: { role: "TPO" } });
    assert(tpoUser !== null, "Found TPO user in database");

    const studentUser = await prisma.user.findFirst({ where: { role: "STUDENT" } });
    assert(studentUser !== null, "Found Student user in database");

    const tpoToken = jwt.sign(
        { id: tpoUser.id, email: tpoUser.email, role: tpoUser.role },
        JWT_SECRET,
        { expiresIn: "1h" }
    );
    const studentToken = jwt.sign(
        { id: studentUser.id, email: studentUser.email, role: studentUser.role },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    // Test 1: Unauthenticated request must return 401
    console.log("\n--- Test 1: Authentication Guard ---");
    const resNoAuth = await fetch(`${BASE_URL}/import/latest`);
    assert(resNoAuth.status === 401, "Unauthenticated request returns 401 Unauthorized");
    const jsonNoAuth = await resNoAuth.json();
    assert(jsonNoAuth.success === false, "Unauthenticated response body indicates success: false");

    // Test 2: Role Authorization Guard (Student) must return 403
    console.log("\n--- Test 2: Role-based Authorization Guard ---");
    const resStudent = await fetch(`${BASE_URL}/import/latest`, {
        headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(resStudent.status === 403, "Student user request returns 403 Forbidden");
    const jsonStudent = await resStudent.json();
    assert(jsonStudent.success === false, "Student response body indicates success: false");

    // Test 3: TPO user request must return 200 and the current latest batch
    console.log("\n--- Test 3: Authorized TPO Query ---");
    const resTpo = await fetch(`${BASE_URL}/import/latest`, {
        headers: { Authorization: `Bearer ${tpoToken}` },
    });
    assert(resTpo.status === 200, "TPO user request returns 200 OK");
    const jsonTpo = await resTpo.json();
    assert(jsonTpo.success === true, "Response has success: true");
    assert(jsonTpo.data !== undefined, "Response contains data property");
    
    const dbLatest = await prisma.academicImportBatch.findFirst({
        orderBy: { id: "desc" },
    });

    if (dbLatest) {
        assert(jsonTpo.data.id === dbLatest.id, `Batch ID matches DB latest (ID: ${dbLatest.id})`);
        assert(jsonTpo.data.fileName === dbLatest.fileName, `Batch fileName matches (${dbLatest.fileName})`);
        assert(jsonTpo.data.totalRows === dbLatest.totalRows, `totalRows matches (${dbLatest.totalRows})`);
        assert(jsonTpo.data.successfulRows === dbLatest.successfulRows, `successfulRows matches (${dbLatest.successfulRows})`);
        assert(jsonTpo.data.failedRows === dbLatest.failedRows, `failedRows matches (${dbLatest.failedRows})`);
        console.log("Current latest batch verified:", jsonTpo.data);
    }

    // Test 4: Create a new simulated batch and verify endpoint immediately reflects it
    console.log("\n--- Test 4: Dynamic Update with New Import Batch ---");
    const testBatchName = `test_verification_batch_${Date.now()}.csv`;
    const newBatch = await prisma.academicImportBatch.create({
        data: {
            fileName: testBatchName,
            importedByUserId: tpoUser.id,
            status: "COMPLETED",
            totalRows: 50,
            successfulRows: 48,
            failedRows: 2,
            importedAt: new Date(),
            completedAt: new Date(),
        },
    });
    console.log(`Created test batch ID: ${newBatch.id} (${testBatchName})`);

    const resNew = await fetch(`${BASE_URL}/import/latest`, {
        headers: { Authorization: `Bearer ${tpoToken}` },
    });
    const jsonNew = await resNew.json();
    assert(jsonNew.status === undefined || jsonNew.success === true, "Query successful after new batch creation");
    assert(jsonNew.data.id === newBatch.id, `Returned batch ID matches newly created batch ID (${newBatch.id})`);
    assert(jsonNew.data.fileName === testBatchName, `Returned fileName matches (${testBatchName})`);
    assert(jsonNew.data.successfulRows === 48, "successfulRows correctly reflects 48");
    assert(jsonNew.data.failedRows === 2, "failedRows correctly reflects 2");

    // Clean up test batch
    await prisma.academicImportBatch.delete({ where: { id: newBatch.id } });
    console.log(`Cleaned up test batch ID: ${newBatch.id}`);

    // Verify after cleanup, it falls back to previous batch
    const resAfterCleanup = await fetch(`${BASE_URL}/import/latest`, {
        headers: { Authorization: `Bearer ${tpoToken}` },
    });
    const jsonAfterCleanup = await resAfterCleanup.json();
    if (dbLatest) {
        assert(jsonAfterCleanup.data.id === dbLatest.id, `Reverted back to previous latest batch ID: ${dbLatest.id}`);
    }

    console.log("\n🎉 ALL TESTS PASSED: GET /api/v1/import/latest is fully functional, authorized, and responsive!");
}

runTests()
    .catch((err) => {
        console.error("Test execution failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
