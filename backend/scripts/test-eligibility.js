
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
    minimumTenth: 60,
    minimumTwelfth: 60,
    minimumDiplomaPercentage: 60,
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





// 1. Missing academic pathway
test(
    "Missing academic pathway",
    { academicPathway: null },
    {},
    false
);

// 2. Invalid academic pathway
test(
    "Invalid academic pathway",
    { academicPathway: "INVALID" },
    {},
    false
);

// 3. CGPA above maximum
test(
    "CGPA above maximum",
    { CGPA: 10.5 },
    {},
    false
);

// 4. Negative CGPA
test(
    "Negative CGPA",
    { CGPA: -1 },
    {},
    false
);

// 5. CGPA NaN
test(
    "CGPA NaN",
    { CGPA: NaN },
    {},
    false
);

// 6. 10th percentage above maximum
test(
    "10th percentage above 100",
    { tenthPercentage: 105 },
    {},
    false
);

// 7. Negative 10th percentage
test(
    "Negative 10th percentage",
    { tenthPercentage: -5 },
    {},
    false
);

// 8. 12th percentage above maximum
test(
    "12th percentage above 100",
    { twelfthPercentage: 105 },
    {},
    false
);

// 9. Negative 12th percentage
test(
    "Negative 12th percentage",
    { twelfthPercentage: -5 },
    {},
    false
);

// 10. Diploma percentage above maximum
test(
    "Diploma percentage above 100",
    {
        academicPathway: "DIPLOMA",
        diplomaPercentage: 105
    },
    {},
    false
);

// 11. Negative diploma percentage
test(
    "Negative diploma percentage",
    {
        academicPathway: "DIPLOMA",
        diplomaPercentage: -5
    },
    {},
    false
);

// 12. Fractional active backlogs
test(
    "Fractional active backlogs",
    { activeBacklogs: 1.5 },
    {},
    false
);

// 13. Negative active backlogs
test(
    "Negative active backlogs",
    { activeBacklogs: -1 },
    {},
    false
);

// 14. Missing active backlogs
test(
    "Missing active backlogs",
    { activeBacklogs: null },
    {},
    false
);

// 15. Previous placement disallowed
test(
    "Previous placement disallowed",
    { selection: { id: 1, status: "SELECTED" } },
    { allowPreviousPlacement: false },
    false
);


console.log("\nEligibility tests completed.");
