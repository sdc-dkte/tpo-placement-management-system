/**
 * test-drive-management.js
 *
 * Reliable test suite for the Placement Drive Management module.
 *
 * Improvements over the original:
 *  1. All failure checks use hard assertions (throw) — not just console.error.
 *  2. Cleanup is scoped to records created by THIS run (timestamp-keyed).
 *  3. Pre-existing TEST_CSE department is never deleted; only newly created records are.
 *  4. prisma.$disconnect() is always called in a top-level finally block.
 *  5. Invalid transition (COMPLETED → UPCOMING) is asserted to throw 422.
 *  6. statusFilter validation is tested.
 *  7. Pure logic tests cover missing-marks cases and the wrong-department case.
 */

require("dotenv").config();

const prisma = require("../src/prismaClient");
const driveService = require("../src/services/drive.service");
const eligibilityService = require("../src/services/eligibility.service");

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts a condition is true; throws with a descriptive message if not.
 * This makes test failures actually fail the process (exit code 1).
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`ASSERTION FAILED: ${message}`);
    }
}

/**
 * Asserts that an async function throws an error with the expected statusCode.
 */
async function assertThrows(fn, expectedStatusCode, label) {
    let threw = false;
    try {
        await fn();
    } catch (err) {
        threw = true;
        assert(
            err.statusCode === expectedStatusCode,
            `${label}: expected statusCode ${expectedStatusCode}, got ${err.statusCode}. Message: ${err.message}`
        );
    }
    assert(threw, `${label}: expected an error to be thrown but none was.`);
}

// ---------------------------------------------------------------------------
// Pure (no-DB) eligibility rule engine tests
// ---------------------------------------------------------------------------

function testPureEligibilityEngine() {
    console.log("\n--- Pure Logic Tests: evaluateStudentEligibility ---");

    const criteria = {
        minimumCGPA: 7.0,
        minimumTenth: 60.0,
        minimumTwelfth: 60.0,
        minimumDiplomaPercentage: 65.0,
        maximumBacklogs: 0,
        allowPreviousPlacement: false,
    };
    const eligibleBranchIds = [1, 2];
    const eligibleYears = [2027];

    // Base eligible HSC student
    const baseHSC = {
        departmentId: 1,
        graduationYear: 2027,
        academicPathway: "HSC",
        CGPA: 8.5,
        tenthPercentage: 80.0,
        twelfthPercentage: 75.0,
        diplomaPercentage: null,
        activeBacklogs: 0,
        selection: null,
    };

    // Case 1: Fully eligible HSC student
    const r1 = eligibilityService.evaluateStudentEligibility(
        baseHSC, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r1.isEligible === true, "Case 1: eligible HSC student should be eligible");
    assert(r1.reasons.length === 0, "Case 1: no reasons expected");
    console.log("  ✔ Case 1 (Eligible HSC student): PASS");

    // Case 2: CGPA too low
    const r2 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, CGPA: 6.8 }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r2.isEligible === false, "Case 2: low CGPA should be ineligible");
    assert(
        r2.reasons.some((s) => s.includes("CGPA")),
        "Case 2: reason must mention CGPA"
    );
    console.log("  ✔ Case 2 (Low CGPA):", r2.reasons[0]);

    // Case 3: Active backlogs exceed limit
    const r3 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, activeBacklogs: 1 }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r3.isEligible === false, "Case 3: backlogs should be ineligible");
    assert(
        r3.reasons.some((s) => s.includes("backlog")),
        "Case 3: reason must mention backlogs"
    );
    console.log("  ✔ Case 3 (Backlogs):", r3.reasons[0]);

    // Case 4: Already placed, allowPreviousPlacement = false
    const r4 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, selection: { id: 10 } }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r4.isEligible === false, "Case 4: already placed should be ineligible");
    assert(
        r4.reasons.some((s) => s.includes("already been placed")),
        "Case 4: reason must mention placement"
    );
    console.log("  ✔ Case 4 (Already placed):", r4.reasons[0]);

    // Case 5: Eligible DIPLOMA student
    const baseDiploma = {
        departmentId: 2,
        graduationYear: 2027,
        academicPathway: "DIPLOMA",
        CGPA: 8.0,
        tenthPercentage: 75.0,
        twelfthPercentage: null,
        diplomaPercentage: 72.0,
        activeBacklogs: 0,
        selection: null,
    };
    const r5 = eligibilityService.evaluateStudentEligibility(
        baseDiploma, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r5.isEligible === true, "Case 5: eligible DIPLOMA student should be eligible");
    console.log("  ✔ Case 5 (Eligible DIPLOMA student): PASS");

    // Case 6: DIPLOMA student — diploma % too low
    const r6 = eligibilityService.evaluateStudentEligibility(
        { ...baseDiploma, diplomaPercentage: 60.0 }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r6.isEligible === false, "Case 6: low diploma % should be ineligible");
    assert(
        r6.reasons.some((s) => s.includes("Diploma percentage")),
        "Case 6: reason must mention Diploma percentage"
    );
    console.log("  ✔ Case 6 (Low diploma %):", r6.reasons[0]);

    // Case 7: Missing 12th marks for HSC student
    const r7 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, twelfthPercentage: null }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r7.isEligible === false, "Case 7: missing 12th marks should be ineligible");
    assert(
        r7.reasons.some((s) => s.includes("12th percentage is not recorded")),
        "Case 7: reason must mention missing 12th marks"
    );
    console.log("  ✔ Case 7 (Missing 12th marks):", r7.reasons[0]);

    // Case 8: Student from wrong department
    const r8 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, departmentId: 99 }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r8.isEligible === false, "Case 8: wrong department should be ineligible");
    assert(
        r8.reasons.some((s) => s.includes("department")),
        "Case 8: reason must mention department"
    );
    console.log("  ✔ Case 8 (Wrong department):", r8.reasons[0]);

    // Case 9: Wrong graduation year
    const r9 = eligibilityService.evaluateStudentEligibility(
        { ...baseHSC, graduationYear: 2026 }, criteria, eligibleBranchIds, eligibleYears
    );
    assert(r9.isEligible === false, "Case 9: wrong graduation year should be ineligible");
    assert(
        r9.reasons.some((s) => s.includes("Graduation year")),
        "Case 9: reason must mention graduation year"
    );
    console.log("  ✔ Case 9 (Wrong graduation year):", r9.reasons[0]);

    // Case 10: No criteria / open drive — everyone passes rule checks
    const r10 = eligibilityService.evaluateStudentEligibility(
        baseHSC, null, [], []
    );
    assert(r10.isEligible === true, "Case 10: open drive with no criteria should be eligible");
    console.log("  ✔ Case 10 (No criteria, open drive): PASS");

    console.log("--- All pure logic tests passed ✔ ---\n");
}

// ---------------------------------------------------------------------------
// Input validation tests (no DB needed)
// ---------------------------------------------------------------------------

async function testInputValidation() {
    console.log("--- Input Validation Tests ---");

    // Invalid companyId
    await assertThrows(
        () => driveService.createPlacementDrive({ companyId: "abc", jobRoleId: 1, title: "T", packageLPA: 5 }),
        400,
        "Invalid companyId"
    );
    console.log('  ✔ Non-integer companyId → 400');

    // Missing title
    await assertThrows(
        () => driveService.createPlacementDrive({ companyId: 1, jobRoleId: 1, title: "   ", packageLPA: 5 }),
        400,
        "Blank title"
    );
    console.log('  ✔ Blank title → 400');

    // Negative package
    await assertThrows(
        () => driveService.createPlacementDrive({ companyId: 1, jobRoleId: 1, title: "T", packageLPA: -1 }),
        400,
        "Negative packageLPA"
    );
    console.log('  ✔ Negative packageLPA → 400');

    // Invalid status
    await assertThrows(
        () => driveService.createPlacementDrive({ companyId: 1, jobRoleId: 1, title: "T", packageLPA: 5, status: "FLYING" }),
        400,
        "Invalid status"
    );
    console.log('  ✔ Invalid status → 400');

    // Deadline after driveDate
    await assertThrows(
        () => driveService.createPlacementDrive({
            companyId: 1,
            jobRoleId: 1,
            title: "T",
            packageLPA: 5,
            driveDate: new Date(Date.now() + 3 * 86400000).toISOString(),
            applicationDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
        }),
        422,
        "Deadline after driveDate"
    );
    console.log('  ✔ Deadline after driveDate → 422');

    // CGPA out of range
    await assertThrows(
        () => driveService.createPlacementDrive({
            companyId: 1, jobRoleId: 1, title: "T", packageLPA: 5,
            eligibility: { minimumCGPA: 11 },
        }),
        400,
        "CGPA > 10"
    );
    console.log('  ✔ minimumCGPA > 10 → 400');

    // Percentage out of range
    await assertThrows(
        () => driveService.createPlacementDrive({
            companyId: 1, jobRoleId: 1, title: "T", packageLPA: 5,
            eligibility: { minimumTenth: 105 },
        }),
        400,
        "minimumTenth > 100"
    );
    console.log('  ✔ minimumTenth > 100 → 400');

    // Non-boolean allowPreviousPlacement
    await assertThrows(
        () => driveService.createPlacementDrive({
            companyId: 1, jobRoleId: 1, title: "T", packageLPA: 5,
            eligibility: { allowPreviousPlacement: "yes" },
        }),
        400,
        "allowPreviousPlacement not boolean"
    );
    console.log('  ✔ Non-boolean allowPreviousPlacement → 400');

    // Invalid graduation year
    await assertThrows(
        () => driveService.createPlacementDrive({
            companyId: 1, jobRoleId: 1, title: "T", packageLPA: 5,
            eligibility: { graduationYears: [1999] },
        }),
        400,
        "graduationYear < 2000"
    );
    console.log('  ✔ graduationYear < 2000 → 400');

    // updatePlacementDriveStatus with invalid driveId
    await assertThrows(
        () => driveService.updatePlacementDriveStatus("xyz", "ONGOING"),
        400,
        "Invalid driveId for status update"
    );
    console.log('  ✔ Non-integer driveId in updateStatus → 400');

    // updatePlacementDriveStatus with unknown status value
    await assertThrows(
        () => driveService.updatePlacementDriveStatus(1, "FLYING"),
        400,
        "Unknown status value"
    );
    console.log('  ✔ Unknown status value in updateStatus → 400');

    console.log("--- All input validation tests passed ✔ ---\n");
}

// ---------------------------------------------------------------------------
// Integration tests (require a live DB)
// ---------------------------------------------------------------------------

async function runIntegrationTests() {
    console.log("--- Integration Tests (live DB) ---");

    const ts = Date.now();

    // Track only IDs created by THIS run so cleanup is safe
    const created = {
        driveId: null,
        testDeptId: null,       // set only if we created the dept
        companyId: null,
        otherCompanyId: null,
        roleId: null,
        otherRoleId: null,
        studentId: null,
        userId: null,
    };

    try {
        // ── 1. Departments ──────────────────────────────────────────────────
        // Upsert so we tolerate a pre-existing TEST_DRIVE dept without deleting it later
        const dept = await prisma.department.upsert({
            where: { code: "TEST_DRIVE" },
            update: {},
            create: { name: `Test Drive Dept ${ts}`, code: "TEST_DRIVE" },
        });
        // Only mark for deletion if we just created it
        const deptWasNew = dept.name === `Test Drive Dept ${ts}`;
        if (deptWasNew) created.testDeptId = dept.id;
        console.log(`  ✔ Dept ready (id=${dept.id}, new=${deptWasNew})`);

        // ── 2. Companies & Roles ────────────────────────────────────────────
        const company = await prisma.company.create({
            data: { name: `IntegCo ${ts}`, isActive: true },
        });
        created.companyId = company.id;

        const role = await prisma.jobRole.create({
            data: { companyId: company.id, title: "SWE Trainee" },
        });
        created.roleId = role.id;

        const otherCompany = await prisma.company.create({
            data: { name: `OtherCo ${ts}`, isActive: true },
        });
        created.otherCompanyId = otherCompany.id;

        const otherRole = await prisma.jobRole.create({
            data: { companyId: otherCompany.id, title: "Analyst" },
        });
        created.otherRoleId = otherRole.id;
        console.log("  ✔ Companies and roles created");

        // ── 3. Mismatched company/role → 422 ───────────────────────────────
        await assertThrows(
            () => driveService.createPlacementDrive({
                companyId: company.id,
                jobRoleId: otherRole.id,
                title: "Bad Drive",
                packageLPA: 5,
            }),
            422,
            "Mismatched company/role"
        );
        console.log("  ✔ Mismatched company/role → 422");

        // ── 4. Non-existent department ID → 404 ────────────────────────────
        await assertThrows(
            () => driveService.createPlacementDrive({
                companyId: company.id,
                jobRoleId: role.id,
                title: "Bad Dept Drive",
                packageLPA: 5,
                eligibility: { departmentIds: [999999] },
            }),
            404,
            "Non-existent departmentId"
        );
        console.log("  ✔ Non-existent departmentId → 404");

        // ── 5. Create a valid drive ─────────────────────────────────────────
        const drive = await driveService.createPlacementDrive({
            companyId: company.id,
            jobRoleId: role.id,
            title: `Campus Drive ${ts}`,
            packageLPA: 8.5,
            driveDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            applicationDeadline: new Date(Date.now() + 3 * 86400000).toISOString(),
            venue: "Hall A",
            hiringProcess: "OA → Tech → HR",
            eligibility: {
                minimumCGPA: 7.0,
                minimumTenth: 60.0,
                minimumTwelfth: 60.0,
                maximumBacklogs: 0,
                allowPreviousPlacement: false,
                departmentIds: [dept.id],
                graduationYears: [2027],
            },
        });
        created.driveId = drive.id;
        assert(drive.id > 0, "Drive must have a valid ID");
        assert(drive.eligibility.minimumCGPA === 7.0, "Eligibility CGPA must be saved");
        assert(drive.eligibility.departments.length === 1, "One eligible department");
        assert(drive.eligibility.graduationYears.includes(2027), "Grad year 2027 set");
        console.log(`  ✔ Drive created (id=${drive.id})`);

        // ── 6. Get drive by ID ──────────────────────────────────────────────
        const fetched = await driveService.getPlacementDriveById(drive.id);
        assert(fetched !== null, "Drive must be fetchable");
        assert(fetched.title === drive.title, "Title must match");
        console.log("  ✔ getPlacementDriveById OK");

        // ── 7. List with filters ────────────────────────────────────────────
        const list = await driveService.getAllPlacementDrives({
            companyId: company.id,
            status: "UPCOMING",
            graduationYear: 2027,
        });
        assert(list.data.length >= 1, "At least one drive should appear in filtered list");
        assert(
            list.data.some((d) => d.id === drive.id),
            "Our test drive must appear in the list"
        );
        console.log(`  ✔ getAllPlacementDrives with filters (count=${list.data.length})`);

        // ── 8. Update drive ─────────────────────────────────────────────────
        const updated = await driveService.updatePlacementDrive(drive.id, {
            packageLPA: 10.0,
            venue: "Hall B",
        });
        assert(updated.packageLPA === 10.0, "PackageLPA must be updated");
        assert(updated.venue === "Hall B", "Venue must be updated");
        console.log("  ✔ updatePlacementDrive OK");

        // ── 9. Status transitions ───────────────────────────────────────────
        const t1 = await driveService.updatePlacementDriveStatus(drive.id, "ONGOING");
        assert(t1.status === "ONGOING", "Must transition to ONGOING");
        console.log("  ✔ UPCOMING → ONGOING");

        const t2 = await driveService.updatePlacementDriveStatus(drive.id, "COMPLETED");
        assert(t2.status === "COMPLETED", "Must transition to COMPLETED");
        console.log("  ✔ ONGOING → COMPLETED");

        // Invalid: COMPLETED → UPCOMING must throw 422 and NOT modify the drive
        await assertThrows(
            () => driveService.updatePlacementDriveStatus(drive.id, "UPCOMING"),
            422,
            "COMPLETED → UPCOMING (terminal state)"
        );
        // Confirm drive is still COMPLETED after the failed transition
        const afterFail = await driveService.getPlacementDriveById(drive.id);
        assert(afterFail.status === "COMPLETED", "Drive must remain COMPLETED after rejected transition");
        console.log("  ✔ COMPLETED → UPCOMING rejected → drive still COMPLETED");

        // Invalid: CANCELLED is also terminal
        const drive2 = await driveService.createPlacementDrive({
            companyId: company.id,
            jobRoleId: role.id,
            title: `Cancellable Drive ${ts}`,
            packageLPA: 5,
        });
        await driveService.updatePlacementDriveStatus(drive2.id, "CANCELLED");
        await assertThrows(
            () => driveService.updatePlacementDriveStatus(drive2.id, "ONGOING"),
            422,
            "CANCELLED → ONGOING (terminal state)"
        );
        // Cleanup drive2 immediately (not tracked in created, so clean here)
        await prisma.placementDrive.delete({ where: { id: drive2.id } });
        console.log("  ✔ CANCELLED → ONGOING rejected → drive cleaned up");

        // ── 10. Replace eligibility criteria ───────────────────────────────
        const newCriteria = await driveService.replaceEligibilityCriteria(drive.id, {
            minimumCGPA: 8.0,
            minimumTenth: 70.0,
            maximumBacklogs: 1,
            allowPreviousPlacement: true,
            departmentIds: [dept.id],
            graduationYears: [2027, 2028],
        });
        assert(newCriteria.minimumCGPA === 8.0, "Criteria CGPA updated");
        assert(newCriteria.graduationYears.includes(2028), "2028 added");
        assert(newCriteria.allowPreviousPlacement === true, "allowPreviousPlacement updated");
        console.log("  ✔ replaceEligibilityCriteria OK");

        // ── 11. Student & Eligibility Engine ───────────────────────────────
        const testUser = await prisma.user.create({
            data: {
                name: "Test Student",
                email: `integ_${ts}@test.edu`,
                passwordHash: "x",
                role: "STUDENT",
            },
        });
        created.userId = testUser.id;

        const testStudent = await prisma.student.create({
            data: {
                userId: testUser.id,
                PRN: `INTEG_${ts}`,
                departmentId: dept.id,
                graduationYear: 2027,
                academicPathway: "HSC",
                CGPA: 8.5,          // ≥ 8.0 ✔
                tenthPercentage: 75, // ≥ 70  ✔
                twelfthPercentage: 70,
                activeBacklogs: 0,  // ≤ 1   ✔
            },
        });
        created.studentId = testStudent.id;

        // Batch eligibility report
        const report = await eligibilityService.getEligibleStudentsForDrive(drive.id, {
            search: `INTEG_${ts}`,
            statusFilter: "all",
        });
        assert(report !== null, "Report must not be null");
        const candidate = report.data.find((s) => s.PRN === testStudent.PRN);
        assert(candidate !== undefined, "Test student must appear in report");
        assert(candidate.isEligible === true, "Test student must be eligible");
        console.log("  ✔ Eligibility Engine batch report: student is ELIGIBLE");

        // Single student check
        const single = await eligibilityService.checkStudentDriveEligibility(
            testStudent.id,
            drive.id
        );
        assert(!single.notFound, "Single check must find student and drive");
        assert(single.isEligible === true, "Single check must return eligible");
        assert(Array.isArray(single.reasons), "reasons must be an array");
        // Academic marks must NOT be in the single-check response (data privacy)
        assert(single.CGPA === undefined, "CGPA must not be returned in single-check response");
        assert(single.tenthPercentage === undefined, "tenthPercentage must not be returned");
        console.log("  ✔ Single eligibility check: ELIGIBLE, no academic data leaked");

        // statusFilter validation
        await assertThrows(
            () => eligibilityService.getEligibleStudentsForDrive(drive.id, { statusFilter: "bad_value" }),
            400,
            "Invalid statusFilter"
        );
        console.log("  ✔ Invalid statusFilter → 400");

        // Non-existent drive
        const notFoundResult = await eligibilityService.getEligibleStudentsForDrive(999999, {});
        assert(notFoundResult === null, "Non-existent drive must return null");
        console.log("  ✔ Non-existent driveId → null");

        console.log("\n--- All integration tests passed ✔ ---");

    } finally {
        // ── Safe cleanup: only delete records created by THIS run ───────────
        console.log("\nCleaning up test records...");

        if (created.studentId) {
            await prisma.student.deleteMany({ where: { id: created.studentId } });
        }
        if (created.userId) {
            await prisma.user.deleteMany({ where: { id: created.userId } });
        }
        if (created.driveId) {
            await prisma.driveEligibleBranch.deleteMany({ where: { driveId: created.driveId } });
            await prisma.driveEligibleYear.deleteMany({ where: { driveId: created.driveId } });
            await prisma.eligibilityCriteria.deleteMany({ where: { driveId: created.driveId } });
            await prisma.placementDrive.deleteMany({ where: { id: created.driveId } });
        }
        if (created.roleId) {
            await prisma.jobRole.deleteMany({ where: { id: created.roleId } });
        }
        if (created.otherRoleId) {
            await prisma.jobRole.deleteMany({ where: { id: created.otherRoleId } });
        }
        if (created.companyId) {
            await prisma.company.deleteMany({ where: { id: created.companyId } });
        }
        if (created.otherCompanyId) {
            await prisma.company.deleteMany({ where: { id: created.otherCompanyId } });
        }
        // Only delete the dept if WE created it in this run
        if (created.testDeptId) {
            await prisma.department.deleteMany({ where: { id: created.testDeptId } });
        }

        console.log("  ✔ Cleanup complete (only records from this run were removed)");
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
    console.log("=== Placement Drive Management Test Suite ===\n");

    // Pure logic tests always run (no DB required)
    testPureEligibilityEngine();
    await testInputValidation();

    // Integration tests require a live DB
    try {
        await prisma.$connect();
        console.log("Connected to database — running integration tests.\n");
        await runIntegrationTests();
    } catch (connErr) {
        if (connErr.code === "P1001" || connErr.message.includes("reach database")) {
            console.warn(
                "\n⚠  Database is not reachable — skipping integration tests.\n" +
                "   Start PostgreSQL and re-run to execute the full suite.\n"
            );
        } else {
            // Unexpected error — re-throw so the process exits with code 1
            throw connErr;
        }
    } finally {
        await prisma.$disconnect();
        console.log("\nDatabase connection closed.");
    }

    console.log("\n=== All available tests completed successfully ===");
}

main().catch((err) => {
    console.error("\n✖ TEST SUITE FAILED:", err.message);
    process.exit(1);
});
