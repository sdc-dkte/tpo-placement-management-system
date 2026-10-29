
const assert = require("node:assert/strict");

const {
    evaluateStudentEligibility,
} = require("../src/services/eligibility.service");

const baseStudent = {
    departmentId: 1,
    graduationYear: 2027,
    CGPA: 8.0,
    tenthPercentage: 85,
    twelfthPercentage: 80,
    diplomaPercentage: null,
    academicPathway: "HSC",
    activeBacklogs: 0,
    selection: null,
};

const baseCriteria = {
    minimumCGPA: 7.0,
    minimumTenthPercentage: 60,
    minimumTwelfthPercentage: 60,
    minimumDiplomaPercentage: null,
    maximumBacklogs: 0,
    allowPreviousPlacement: true,
};

const eligibleBranches = [1];
const eligibleYears = [2027];

function test(name, studentChanges, criteriaChanges, expected) {
    const student = { ...baseStudent, ...studentChanges };
    const criteria = { ...baseCriteria, ...criteriaChanges };

    const result = evaluateStudentEligibility(
        student,
        criteria,
        eligibleBranches,
        eligibleYears
    );

    assert.equal(
        result.isEligible,
        expected,
        `${name}: ${JSON.stringify(result.reasons)}`
    );

    console.log(`PASS: ${name}`);
}

test("Eligible student", {}, {}, true);

test(
    "Department mismatch",
    { departmentId: 2 },
    {},
    false
);

test(
    "Graduation year mismatch",
    { graduationYear: 2028 },
    {},
    false
);

test(
    "CGPA below minimum",
    { CGPA: 6.5 },
    {},
    false
);

test(
    "Missing CGPA",
    { CGPA: null },
    {},
    false
);

test(
    "Backlogs exceed limit",
    { activeBacklogs: 2 },
    { maximumBacklogs: 1 },
    false
);

test(
    "Previous selection disallowed",
    { selection: { id: 1, status: "SELECTED" } },
    { allowPreviousPlacement: false },
    false
);

test(
    "HSC student missing 12th percentage",
    { twelfthPercentage: null },
    { minimumTwelfth: 60 },
    false
);

test(
    "Diploma student missing diploma percentage",
    {
        academicPathway: "DIPLOMA",
        diplomaPercentage: null,
    },
    { minimumDiplomaPercentage: 60 },
    false
);

console.log("\nEligibility tests completed.");
