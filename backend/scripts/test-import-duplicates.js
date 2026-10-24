
require("dotenv").config();

const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

const prisma = require("../src/prismaClient");

const BASE_URL =
    process.env.API_BASE_URL || "http://localhost:5000/api/v1";
const TOKEN = process.env.TPO_TOKEN;

if (!TOKEN) {
    console.error("TPO_TOKEN is missing.");
    process.exit(1);
}

const tag = randomUUID().replace(/-/g, "").slice(0, 12);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tpo-duplicates-"));
const results = [];

const headers = [
    "PRN",
    "name",
    "email",
    "departmentCode",
    "graduationYear",
    "academicPathway",
    "CGPA",
    "tenthPercentage",
    "twelfthPercentage",
    "diplomaPercentage",
    "activeBacklogs",
];

function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function makeRow(PRN, email, name = "Duplicate Test Student") {
    return {
        PRN,
        name,
        email,
        departmentCode: "CSE",
        graduationYear: 2027,
        academicPathway: "HSC",
        CGPA: 8.2,
        tenthPercentage: 85,
        twelfthPercentage: 82,
        diplomaPercentage: "",
        activeBacklogs: 0,
    };
}

function makeCsv(rows) {
    return [
        headers.join(","),
        ...rows.map(row => headers.map(h => csvCell(row[h])).join(",")),
    ].join("\r\n");
}

async function uploadCsv(label, rows) {
    const filePath = path.join(tempDir, `${label}.csv`);
    fs.writeFileSync(filePath, makeCsv(rows), "utf8");

    const boundary = `----TPOBoundary${randomUUID().replace(/-/g, "")}`;
    const fileData = fs.readFileSync(filePath);
    const prefix = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${label}.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n`
    );
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([prefix, fileData, suffix]);

    const response = await fetch(`${BASE_URL}/import/students`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
    });

    const text = await response.text();
    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = { rawResponse: text };
    }

    console.log(`\n${label}: HTTP ${response.status}`);
    console.log(JSON.stringify(data, null, 2));

    if (!response.ok) {
        throw new Error(`${label} upload failed with HTTP ${response.status}`);
    }

    if (!data.batchId && !data.id) {
        console.warn(
            "Could not identify the batch ID in the upload response. " +
            "We'll inspect the controller response shape before continuing."
        );
    }

    return data;
}

function recordResult(name, passed, details) {
    results.push({ name, passed, details });
    console.log(`${passed ? "PASS" : "FAIL"}: ${name} — ${details}`);
}


async function verifyBatchRows(batchId, expectedRows) {
    const rows = await prisma.academicImportRow.findMany({
        where: { batchId },
        orderBy: { rowNumber: "asc" },
        select: {
            rowNumber: true,
            PRN: true,
            status: true,
            errorMessage: true,
            studentId: true,
        },
    });

    console.log(`\nRows for batch ${batchId}:`);
    console.table(rows);

    const checks = expectedRows.map((expected) => {
        const row = rows.find(
            (item) => item.rowNumber === expected.rowNumber
        );

        if (!row) {
            recordResult(
                expected.name,
                false,
                `Row ${expected.rowNumber} was not found.`
            );
            return false;
        }

        const statusMatches = row.status === expected.status;
        const errorMatches = expected.errorIncludes
            ? (row.errorMessage || "").includes(expected.errorIncludes)
            : true;

        const passed = statusMatches && errorMatches;

        recordResult(
            expected.name,
            passed,
            `Row ${row.rowNumber}: status=${row.status}, error=${row.errorMessage || "none"}`
        );

        return passed;
    });

    return { rows, passed: checks.every(Boolean) };
}


async function main() {
    console.log("Duplicate-record test tag:", tag);

    // Read-only check: confirm the chosen department exists.
    const department = await prisma.department.findUnique({
        where: { code: "CSE" },
        select: { id: true, code: true },
    });

    if (!department) {
        throw new Error("CSE department was not found.");
    }

    // Create a baseline student through the real CSV endpoint.
    const basePRN = `DUP${tag}01`;
    const baseEmail = `dup.base.${tag}@example.com`;

    const baseline = await uploadCsv(
        "duplicate-baseline",
        [makeRow(basePRN, baseEmail, "Duplicate Test Baseline")]
    );

    console.log(
        "\nBaseline created. Review its response above before interpreting " +
        "the remaining results."
    );

    // Find the actual records created by the baseline upload.
    const baselineUser = await prisma.user.findUnique({
        where: { email: baseEmail },
        include: { studentProfile: true },
    });

    if (!baselineUser?.studentProfile) {
        throw new Error(
            "Baseline student was not created. Stop and inspect the upload response."
        );
    }

    const originalUserId = baselineUser.id;
    const originalStudentId = baselineUser.studentProfile.id;

    // Test 1: existing PRN, different email.
    const prnConflictEmail = `dup.prn.${tag}@example.com`;
    const prnConflict = await uploadCsv(
        "duplicate-existing-prn",
        [makeRow(basePRN, prnConflictEmail, "PRN Conflict Test")]
    );

    await verifyBatchRows(prnConflict.batchId, [
        {
            rowNumber: 1,
            status: "FAILED",
            errorIncludes: "PRN is already registered.",
            name: "Existing PRN conflict is FAILED with correct error",
        },
    ]);

    const prnConflictUser = await prisma.user.findUnique({
        where: { email: prnConflictEmail },
    });
    const originalAfterPrn = await prisma.student.findUnique({
        where: { PRN: basePRN },
        include: { user: true },
    });

    recordResult(
        "Existing PRN with different email is rejected",
        !prnConflictUser &&
        originalAfterPrn?.id === originalStudentId &&
        originalAfterPrn?.userId === originalUserId,
        "No conflicting user should be created; original student should remain intact."
    );

    // Test 2: existing email, different PRN.
    const emailConflictPRN = `DUP${tag}02`;
    const emailConflict = await uploadCsv(
        "duplicate-existing-email",
        [makeRow(emailConflictPRN, baseEmail, "Email Conflict Test")]
    );

    await verifyBatchRows(emailConflict.batchId, [
        {
            rowNumber: 1,
            status: "FAILED",
            errorIncludes: "Email is already registered.",
            name: "Existing email conflict is FAILED with correct error",
        },
    ]);

    const emailConflictStudent = await prisma.student.findUnique({
        where: { PRN: emailConflictPRN },
    });
    const originalAfterEmail = await prisma.user.findUnique({
        where: { email: baseEmail },
        include: { studentProfile: true },
    });

    recordResult(
        "Existing email with different PRN is rejected",
        !emailConflictStudent &&
        originalAfterEmail?.id === originalUserId &&
        originalAfterEmail?.studentProfile?.id === originalStudentId,
        "No conflicting student should be created; original user should remain intact."
    );

    // Test 3a: duplicate PRN within the same CSV.
    const sameCsvPRN = `DUP${tag}03`;
    const sameCsvEmail1 = `dup.sameprn1.${tag}@example.com`;
    const sameCsvEmail2 = `dup.sameprn2.${tag}@example.com`;

    const samePrnBatch = await uploadCsv(
        "duplicate-prn-within-csv",
        [
            makeRow(sameCsvPRN, sameCsvEmail1, "Same PRN First Row"),
            makeRow(sameCsvPRN, sameCsvEmail2, "Same PRN Second Row"),
        ]
    );

    const samePrnCheck = await verifyBatchRows(samePrnBatch.batchId, [
        {
            rowNumber: 1,
            status: "SUCCESS",
            name: "First repeated-PRN row succeeds",
        },
        {
            rowNumber: 2,
            status: "FAILED",
            errorIncludes: "PRN is already registered.",
            name: "Second repeated-PRN row fails with correct error",
        },
    ]);

    const samePrnStudents = await prisma.student.findMany({
        where: { PRN: sameCsvPRN },
        include: { user: true },
    });
    const samePrnUsers = await prisma.user.findMany({
        where: { email: { in: [sameCsvEmail1, sameCsvEmail2] } },
    });

    recordResult(
        "Repeated PRN within CSV does not create duplicate students",
        samePrnStudents.length === 1 && samePrnUsers.length === 1,
        `Found ${samePrnStudents.length} student(s) and ${samePrnUsers.length} user(s); expected one of each.`
    );

    // Test 3b: duplicate email within the same CSV.
    const sameEmail = `dup.sameemail.${tag}@example.com`;
    const sameEmailPRN1 = `DUP${tag}04`;
    const sameEmailPRN2 = `DUP${tag}05`;

    const sameEmailBatch = await uploadCsv(
        "duplicate-email-within-csv",
        [
            makeRow(sameEmailPRN1, sameEmail, "Same Email First Row"),
            makeRow(sameEmailPRN2, sameEmail, "Same Email Second Row"),
        ]
    );

    const sameEmailCheck = await verifyBatchRows(sameEmailBatch.batchId, [
        {
            rowNumber: 1,
            status: "SUCCESS",
            name: "First repeated-email row succeeds",
        },
        {
            rowNumber: 2,
            status: "FAILED",
            errorIncludes: "Email is already registered.",
            name: "Second repeated-email row fails with correct error",
        },
    ]);

    const sameEmailUsers = await prisma.user.findMany({
        where: { email: sameEmail },
    });
    const sameEmailStudents = await prisma.student.findMany({
        where: { PRN: { in: [sameEmailPRN1, sameEmailPRN2] } },
    });

    recordResult(
        "Repeated email within CSV does not create duplicate users",
        sameEmailUsers.length === 1 && sameEmailStudents.length === 1,
        `Found ${sameEmailUsers.length} user(s) and ${sameEmailStudents.length} student(s); expected one of each.`
    );

    console.log("\nFinal test summary:");
    for (const result of results) {
        console.log(
            `${result.passed ? "PASS" : "FAIL"} — ${result.name}: ${result.details}`
        );
    }

    console.log(
        `\n${results.filter(r => r.passed).length}/${results.length} checks passed.`
    );
    console.log(
        "Batch IDs should be taken from the upload responses above. " +
        "Inspect those batch summaries to confirm which rows failed."
    );

    // Intentionally do not delete test records or batches automatically.
}

main()
    .catch(error => {
        console.error("\nTEST RUN STOPPED:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });
