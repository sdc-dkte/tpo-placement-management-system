require("dotenv").config();
const assert = require("node:assert/strict");
const prisma = require("../src/prismaClient");
const driveService = require("../src/services/drive.service");
const eligibilityService = require("../src/services/eligibility.service");

async function runTests() {
    console.log("=== Starting Placement Drive Management Unit & Integration Tests ===");

    // Always run pure logic and validation tests
    await testPureEligibilityEngine();

    try {
        await prisma.$connect();
        console.log("✔ Connected to database successfully.");
    } catch (e) {
        console.log("Database connection could not be established:", e.message);
        console.log("Skipping database-dependent integration tests.");
        return;
    }

    let testCompany = null;
    let testRole = null;
    let otherCompany = null;
    let otherRole = null;
    let testDept = null;
    let createdDrive = null;
    let testStudentUser = null;
    let testStudent = null;

    try {
        // 1. Setup departments
        testDept = await prisma.department.upsert({
            where: { code: "TEST_CSE" },
            update: {},
            create: { name: "Test Computer Science", code: "TEST_CSE" },
        });
        console.log("✔ Test department ready.");

        // 2. Setup Company and Job Roles
        const timestamp = Date.now();
        testCompany = await prisma.company.create({
            data: {
                name: `Test Tech Solutions ${timestamp}`,
                website: "https://testtech.example.com",
                description: "Innovations in tech",
                isActive: true,
            },
        });

        testRole = await prisma.jobRole.create({
            data: {
                companyId: testCompany.id,
                title: "Software Engineer Trainee",
                description: "Full stack engineering",
                domain: "Software",
            },
        });

        otherCompany = await prisma.company.create({
            data: {
                name: `Other Corp ${timestamp}`,
                website: "https://othercorp.example.com",
            },
        });

        otherRole = await prisma.jobRole.create({
            data: {
                companyId: otherCompany.id,
                title: "Analyst",
            },
        });

        console.log("✔ Test companies and roles created.");

        // 3. Test Business Rule: Role from another company must fail with 422
        try {
            await driveService.createPlacementDrive({
                companyId: testCompany.id,
                jobRoleId: otherRole.id, // Does not belong to testCompany!
                title: "Mismatched Drive",
                packageLPA: 7.5,
            });
            console.error("✖ FAILED: Mismatched company/role did not throw error!");
        } catch (err) {
            console.log("✔ PASSED: Role belonging to another company was properly rejected (Status:", err.statusCode, ")");
        }

        // 3.1 Test: Non-existent department ID must be rejected during creation
        try {
            await driveService.createPlacementDrive({
                companyId: testCompany.id,
                jobRoleId: testRole.id,
                title: "Invalid Department Drive",
                packageLPA: 8.0,
                eligibility: {
                    departmentIds: [999999],
                },
            });

            console.error("✖ FAILED: Non-existent department ID was accepted during creation!");
        } catch (err) {
            if (
                err.statusCode === 400 &&
                err.message.startsWith("Department IDs not found:")
            ) {
                console.log(
                    "✔ PASSED: Non-existent department ID rejected during creation."
                );
            } else {
                console.error(
                    "✖ FAILED: Unexpected creation validation error:",
                    err.statusCode,
                    err.message
                );
            }
        }

        // 4. Test Creation of Drive with full criteria
        createdDrive = await driveService.createPlacementDrive({
            companyId: testCompany.id,
            jobRoleId: testRole.id,
            title: `Campus Hiring ${timestamp}`,
            packageLPA: 8.5,
            driveDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
            applicationDeadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
            status: "UPCOMING",
            venue: "Main Auditorium",
            hiringProcess: "Online assessment -> Technical Interview -> HR Round",
            eligibility: {
                minimumCGPA: 7.5,
                minimumTenth: 70.0,
                minimumTwelfth: 65.0,
                maximumBacklogs: 0,
                allowPreviousPlacement: false,
                departmentIds: [testDept.id],
                graduationYears: [2027],
            },
        });

        console.log("✔ PASSED: Placement drive created successfully. ID:", createdDrive.id);
        console.log("  Drive Title:", createdDrive.title);
        console.log("  Eligible branches count:", createdDrive.eligibleBranches.length);
        console.log("  Eligible years count:", createdDrive.eligibleYears.length);

        // 5. Test Listing Drives with Filters
        const listResult = await driveService.getAllPlacementDrives({
            companyId: testCompany.id,
            status: "UPCOMING",
            departmentId: testDept.id,
            graduationYear: 2027,
        });
        console.log("✔ PASSED: Drives listed with filters. Count found:", listResult.data.length);

        // 6. Test Get Drive by ID
        const singleDrive = await driveService.getPlacementDriveById(createdDrive.id);
        console.log("✔ PASSED: Retrieved single drive details:", singleDrive.title);

        // 7. Test Updating Drive
        const updated = await driveService.updatePlacementDrive(createdDrive.id, {
            title: `Updated Campus Hiring ${timestamp}`,
            packageLPA: 9.0,
            venue: "Auditorium Hall B",
        });
        console.log("✔ PASSED: Drive updated. New Package LPA:", updated.packageLPA);
        // 7.0.1 Test: Non-existent department ID must be rejected during update
        try {
            await driveService.updatePlacementDrive(createdDrive.id, {
                eligibility: {
                    departmentIds: [999999],
                },
            });

            console.error("✖ FAILED: Non-existent department ID was accepted during update!");
        } catch (err) {
            if (
                err.statusCode === 400 &&
                err.message.startsWith("One or more department IDs do not exist")
            ) {
                console.log(
                    "✔ PASSED: Non-existent department ID rejected during update."
                );
            } else {
                console.error(
                    "✖ FAILED: Unexpected update validation error:",
                    err.statusCode,
                    err.message
                );
            }
        }
        // 7.1 Test: General drive update must reject status changes
        try {
            await driveService.updatePlacementDrive(createdDrive.id, {
                status: "CANCELLED",
            });

            console.error(
                "✖ FAILED: General update allowed a status change!"
            );
        } catch (err) {
            if (
                err.statusCode === 400 &&
                err.message.includes("PATCH /drives/:driveId/status")
            ) {
                console.log(
                    "✔ PASSED: General update correctly rejected status changes."
                );
            } else {
                console.error(
                    "✖ FAILED: Unexpected error for status protection:",
                    err.statusCode,
                    err.message
                );
            }
        }

        // 8. Test Status Transitions
        const ongoingStatus = await driveService.updatePlacementDriveStatus(createdDrive.id, "ONGOING");
        console.log("✔ PASSED: Transitioned UPCOMING -> ONGOING. Status:", ongoingStatus.status);

        const completedStatus = await driveService.updatePlacementDriveStatus(createdDrive.id, "COMPLETED");
        console.log("✔ PASSED: Transitioned ONGOING -> COMPLETED. Status:", completedStatus.status);

        try {
            await driveService.updatePlacementDriveStatus(createdDrive.id, "UPCOMING");
            console.error("✖ FAILED: Invalid status transition (COMPLETED -> UPCOMING) did not throw!");
        } catch (err) {
            console.log("✔ PASSED: Invalid status transition correctly blocked (Status:", err.statusCode, ")");
        }

        // 9. Setup Test Students & Test Dynamic Eligibility Engine
        const studentEmail = `student_${timestamp}@test.edu`;
        testStudentUser = await prisma.user.create({
            data: {
                name: "Test Candidate",
                email: studentEmail,
                passwordHash: "dummyhash",
                role: "STUDENT",
            },
        });

        testStudent = await prisma.student.create({
            data: {
                userId: testStudentUser.id,
                PRN: `PRN_${timestamp}`,
                departmentId: testDept.id,
                graduationYear: 2027,
                academicPathway: "HSC",
                CGPA: 8.2, // Eligible (min is 7.5)
                tenthPercentage: 82.0, // Eligible (min is 70)
                twelfthPercentage: 78.0, // Eligible (min is 65)
                activeBacklogs: 0,
            },
        });

        const eligibilityEval = await eligibilityService.getEligibleStudentsForDrive(createdDrive.id, {
            search: `PRN_${timestamp}`,
            statusFilter: "all",
        });

        console.log("✔ PASSED: Evaluated candidate students count:", eligibilityEval.summary.totalEvaluated);
        const candidateInResult = eligibilityEval.data.find((s) => s.PRN === testStudent.PRN);
        if (candidateInResult && candidateInResult.isEligible) {
            console.log("✔ PASSED: Test student was correctly evaluated as ELIGIBLE.");
        } else {
            console.error("✖ FAILED: Test student evaluation unexpected:", candidateInResult);
        }

        // Single student check
        const singleCheck = await eligibilityService.checkStudentDriveEligibility(testStudent.id, createdDrive.id);
        console.log("✔ PASSED: checkStudentDriveEligibility result:", singleCheck.isEligible, singleCheck.reasons);

    } catch (testError) {
        console.error("Error during tests:", testError);
    } finally {
        console.log("\nCleaning up test artifacts...");
        if (createdDrive) {
            await prisma.driveEligibleBranch.deleteMany({ where: { driveId: createdDrive.id } });
            await prisma.driveEligibleYear.deleteMany({ where: { driveId: createdDrive.id } });
            await prisma.eligibilityCriteria.deleteMany({ where: { driveId: createdDrive.id } });
            await prisma.placementDrive.deleteMany({ where: { id: createdDrive.id } });
        }
        if (testStudent) {
            await prisma.student.deleteMany({ where: { id: testStudent.id } });
        }
        if (testStudentUser) {
            await prisma.user.deleteMany({ where: { id: testStudentUser.id } });
        }
        if (testRole) {
            await prisma.jobRole.deleteMany({ where: { id: testRole.id } });
        }
        if (otherRole) {
            await prisma.jobRole.deleteMany({ where: { id: otherRole.id } });
        }
        if (testCompany) {
            await prisma.company.deleteMany({ where: { id: testCompany.id } });
        }
        if (otherCompany) {
            await prisma.company.deleteMany({ where: { id: otherCompany.id } });
        }
        if (testDept) {
            await prisma.department.deleteMany({ where: { id: testDept.id } });
        }
        await prisma.$disconnect();
        console.log("✔ Cleanup complete.");
    }
}

async function testPureEligibilityEngine() {
    console.log("--- Running Pure Logic & Input Validation Tests ---");
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

    // Case 1: Fully eligible student
    const student1 = {
        departmentId: 1,
        graduationYear: 2027,
        academicPathway: "HSC",
        CGPA: 8.5,
        tenthPercentage: 80.0,
        twelfthPercentage: 75.0,
        activeBacklogs: 0,
        selection: null,
    };
    const res1 = eligibilityService.evaluateStudentEligibility(student1, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res1.isEligible, true, "Case 1 should be eligible");
    console.log("✔ Pure Test Case 1 (Eligible HSC student): PASS");

    // Case 2: Ineligible due to CGPA
    const student2 = { ...student1, CGPA: 6.8 };
    const res2 = eligibilityService.evaluateStudentEligibility(student2, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res2.isEligible, false, "Case 2 should be ineligible");
    console.log("✔ Pure Test Case 2 (Low CGPA): PASS -> Reasons:", res2.reasons);

    // Case 3: Ineligible due to backlogs
    const student3 = { ...student1, activeBacklogs: 1 };
    const res3 = eligibilityService.evaluateStudentEligibility(student3, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res3.isEligible, false, "Case 3 should be ineligible");
    console.log("✔ Pure Test Case 3 (Backlogs): PASS -> Reasons:", res3.reasons);

    // Case 4: Ineligible due to already placed (official StudentSelection)
    const student4 = { ...student1, selection: { id: 10, status: "SELECTED" } };
    const res4 = eligibilityService.evaluateStudentEligibility(student4, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res4.isEligible, false, "Case 4 should be ineligible");
    console.log("✔ Pure Test Case 4 (Already placed): PASS -> Reasons:", res4.reasons);

    // Case 5: Diploma student eligible
    const student5 = {
        departmentId: 2,
        graduationYear: 2027,
        academicPathway: "DIPLOMA",
        CGPA: 8.0,
        tenthPercentage: 75.0,
        diplomaPercentage: 72.0,
        twelfthPercentage: null,
        activeBacklogs: 0,
        selection: null,
    };
    const res5 = eligibilityService.evaluateStudentEligibility(student5, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res5.isEligible, true, "Case 5 should be eligible");
    console.log("✔ Pure Test Case 5 (Diploma student eligible): PASS");

    // Case 6: Defensive guard on null/undefined student
    const res6 = eligibilityService.evaluateStudentEligibility(null, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(res6.isEligible, false, "Null student must be handled safely");
    assert.ok(res6.reasons.length > 0);
    console.log("✔ Pure Test Case 6 (Null student defensive guard): PASS");

    // Case 7: Missing eligibility criteria (drive without criteria must not silently make students eligible)
    const res7MissingCriteria = eligibilityService.evaluateStudentEligibility(student1, null, eligibleBranchIds, eligibleYears);
    assert.equal(res7MissingCriteria.isEligible, false, "Missing criteria must reject student");
    assert.ok(res7MissingCriteria.reasons.includes("Eligibility criteria have not been configured for this drive."));
    console.log("✔ Pure Test Case 7 (Missing eligibility criteria rejection): PASS");

    // Case 8: Missing academic data tests
    const resMissingCGPA = eligibilityService.evaluateStudentEligibility({ ...student1, CGPA: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissingCGPA.isEligible, false);
    assert.ok(resMissingCGPA.reasons.includes("CGPA is missing or invalid."));

    const resMissing10th = eligibilityService.evaluateStudentEligibility({ ...student1, tenthPercentage: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissing10th.isEligible, false);
    assert.ok(resMissing10th.reasons.includes("10th percentage is missing or invalid."));

    const resMissingPathway = eligibilityService.evaluateStudentEligibility({ ...student1, academicPathway: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissingPathway.isEligible, false);
    assert.ok(resMissingPathway.reasons.includes("Academic pathway is missing or invalid."));

    const resMissing12th = eligibilityService.evaluateStudentEligibility({ ...student1, twelfthPercentage: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissing12th.isEligible, false);
    assert.ok(resMissing12th.reasons.includes("12th percentage is missing or invalid."));

    const resMissingDiploma = eligibilityService.evaluateStudentEligibility({ ...student5, diplomaPercentage: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissingDiploma.isEligible, false);
    assert.ok(resMissingDiploma.reasons.includes("Diploma percentage is missing or invalid."));
    console.log("✔ Pure Test Case 8 (Missing academic data rejection): PASS");

    // Case 9: Backlog handling (null means no restriction; configured requires valid backlogs)
    const criteriaNoBacklogRestriction = { ...criteria, maximumBacklogs: null };
    const resNullBacklogs = eligibilityService.evaluateStudentEligibility({ ...student1, activeBacklogs: 5 }, criteriaNoBacklogRestriction, eligibleBranchIds, eligibleYears);
    assert.equal(resNullBacklogs.isEligible, true, "maximumBacklogs: null should impose no backlog restriction");

    const resMissingBacklogs = eligibilityService.evaluateStudentEligibility({ ...student1, activeBacklogs: null }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resMissingBacklogs.isEligible, false, "Configured backlogs must reject null backlog information");
    assert.ok(resMissingBacklogs.reasons.includes("Active backlog information is missing or invalid."));

    const resInvalidBacklogs = eligibilityService.evaluateStudentEligibility({ ...student1, activeBacklogs: -1 }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resInvalidBacklogs.isEligible, false);
    console.log("✔ Pure Test Case 9 (Backlog handling with null and invalid values): PASS");

    // Case 10: Declined offers handling
    const resDeclinedOffer = eligibilityService.evaluateStudentEligibility({ ...student1, selection: { id: 10, status: "OFFER_DECLINED" } }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resDeclinedOffer.isEligible, true, "Declined offer must not disqualify student");

    const resAcceptedOffer = eligibilityService.evaluateStudentEligibility({ ...student1, selection: { id: 10, status: "OFFER_ACCEPTED" } }, criteria, eligibleBranchIds, eligibleYears);
    assert.equal(resAcceptedOffer.isEligible, false, "Accepted offer must disqualify student");
    console.log("✔ Pure Test Case 10 (Declined vs Accepted offers): PASS");

    // Case 11: Invalid pagination parameters validation
    let paginationErrCount = 0;
    try {
        await eligibilityService.getEligibleStudentsForDrive(1, { page: 0 });
    } catch (e) {
        if (e.statusCode === 400) paginationErrCount++;
    }
    try {
        await eligibilityService.getEligibleStudentsForDrive(1, { limit: 0 });
    } catch (e) {
        if (e.statusCode === 400) paginationErrCount++;
    }
    try {
        await eligibilityService.getEligibleStudentsForDrive(1, { limit: 101 });
    } catch (e) {
        if (e.statusCode === 400) paginationErrCount++;
    }
    try {
        await eligibilityService.getEligibleStudentsForDrive(1, { page: "invalid" });
    } catch (e) {
        if (e.statusCode === 400) paginationErrCount++;
    }
    assert.equal(paginationErrCount, 4, `Expected 4 pagination rejections, got ${paginationErrCount}`);
    console.log("✔ Pure Test Case 11 (Invalid pagination rejected before DB queries): PASS");

    // Case 12: checkStudentDriveEligibility ID validation
    const res12a = await eligibilityService.checkStudentDriveEligibility("abc", 1);
    assert.equal(res12a.error, true, "Invalid studentId must return error: true");
    const res12b = await eligibilityService.checkStudentDriveEligibility(1, -5);
    assert.equal(res12b.error, true, "Negative driveId must return error: true");
    console.log("✔ Pure Test Case 12 (Student drive eligibility ID validation): PASS");

    // Case 13: createPlacementDrive input validation
    let errCount = 0;
    try {
        await driveService.createPlacementDrive(null);
    } catch (e) {
        if (e.statusCode === 400) errCount++;
    }
    try {
        await driveService.createPlacementDrive({ companyId: "xyz" });
    } catch (e) {
        if (e.statusCode === 400) errCount++;
    }
    try {
        await driveService.createPlacementDrive({ companyId: 1, jobRoleId: -1 });
    } catch (e) {
        if (e.statusCode === 400) errCount++;
    }
    try {
        await driveService.createPlacementDrive({ companyId: 1, jobRoleId: 1, title: "   ", packageLPA: 5 });
    } catch (e) {
        if (e.statusCode === 400) errCount++;
    }
    try {
        await driveService.createPlacementDrive({ companyId: 1, jobRoleId: 1, title: "Valid", packageLPA: -5 });
    } catch (e) {
        if (e.statusCode === 400) errCount++;
    }
    assert.equal(errCount, 5, `Expected 5 validation rejections, got ${errCount}`);
    console.log("✔ Pure Test Case 13 (createPlacementDrive payload validation): PASS");

    // Case 14: updatePlacementDrive ID & field validation
    let updateErrCount = 0;
    try {
        await driveService.updatePlacementDrive("not-a-number", {});
    } catch (e) {
        if (e.statusCode === 400) updateErrCount++;
    }
    try {
        await driveService.updatePlacementDrive(0, {});
    } catch (e) {
        if (e.statusCode === 400) updateErrCount++;
    }
    try {
        await driveService.updatePlacementDrive(1, null);
    } catch (e) {
        if (e.statusCode === 400) updateErrCount++;
    }
    assert.equal(updateErrCount, 3, `Expected 3 update validation rejections, got ${updateErrCount}`);
    console.log("✔ Pure Test Case 14 (updatePlacementDrive ID validation): PASS");

    // Case 15: updatePlacementDriveStatus validation
    let statusErrCount = 0;
    try {
        await driveService.updatePlacementDriveStatus("invalid-id", "ONGOING");
    } catch (e) {
        if (e.statusCode === 400) statusErrCount++;
    }
    try {
        await driveService.updatePlacementDriveStatus(1, "");
    } catch (e) {
        if (e.statusCode === 400) statusErrCount++;
    }
    assert.equal(statusErrCount, 2, `Expected 2 status validation rejections, got ${statusErrCount}`);
    console.log("✔ Pure Test Case 15 (updatePlacementDriveStatus validation): PASS");

    // Case 16: replaceEligibilityCriteria validation (payload must be an object)
    let criteriaErrCount = 0;
    try {
        await driveService.replaceEligibilityCriteria("bad-id", {});
    } catch (e) {
        if (e.statusCode === 400) criteriaErrCount++;
    }
    try {
        await driveService.replaceEligibilityCriteria(1, null);
    } catch (e) {
        if (e.statusCode === 400) criteriaErrCount++;
    }
    assert.equal(criteriaErrCount, 2, `Expected 2 criteria validation rejections, got ${criteriaErrCount}`);
    console.log("✔ Pure Test Case 16 (replaceEligibilityCriteria ID and payload validation): PASS");
}

runTests();
