
const {
    validateEligibilityCriteria,
} = require("../src/services/drive.service");

const validCriteria = {
    minimumCGPA: 7.5,
    minimumTenth: 60,
    minimumTwelfth: 60,
    minimumDiplomaPercentage: 60,
    maximumBacklogs: 0,
    allowPreviousPlacement: true,
    departmentIds: [1, 2],
    graduationYears: [2026, 2027],
};

const tests = [
    ["Valid criteria", {}, true],
    ["CGPA above 10", { minimumCGPA: 11 }, false],
    ["Negative CGPA", { minimumCGPA: -1 }, false],
    ["Tenth above 100", { minimumTenth: 105 }, false],
    ["Negative twelfth", { minimumTwelfth: -5 }, false],
    ["Diploma above 100", { minimumDiplomaPercentage: 110 }, false],
    ["Negative backlogs", { maximumBacklogs: -1 }, false],
    ["Fractional backlogs", { maximumBacklogs: 1.5 }, false],
    ["String boolean", { allowPreviousPlacement: "false" }, false],
    ["Negative department ID", { departmentIds: [-1] }, false],
    ["Invalid graduation year", { graduationYears: [2200] }, false],
    ["Minimum CGPA", { minimumCGPA: 0 }, true],
    ["Maximum CGPA", { minimumCGPA: 10 }, true],
    ["Minimum percentage", { minimumTenth: 0 }, true],
    ["Maximum percentage", { minimumTenth: 100 }, true],
    ["Zero backlogs", { maximumBacklogs: 0 }, true],
    ["Empty department list", { departmentIds: [] }, true],
    ["Empty graduation year list", { graduationYears: [] }, true],
    ["Null twelfth percentage", { minimumTwelfth: null }, true],
    ["Null diploma percentage", { minimumDiplomaPercentage: null }, true],
    // Graduation year boundary and duplicate tests
    ["Minimum graduation year", { graduationYears: [2000] }, true],
    ["Maximum graduation year", { graduationYears: [2100] }, true],
    ["Graduation year below minimum", { graduationYears: [1999] }, false],
    ["Graduation year above maximum", { graduationYears: [2101] }, false],
    ["Duplicate graduation years", { graduationYears: [2027, 2027] }, false],
    ["String graduation year", { graduationYears: ["2027"] }, false],
    ["Non-array graduation years", { graduationYears: "2027" }, false],
    ["Duplicate department IDs", { departmentIds: [1, 1] }, false],
    ["String department ID", { departmentIds: ["1"] }, false],
    ["Negative department ID", { departmentIds: [-1] }, false],
    ["Non-array department IDs", { departmentIds: "1" }, false],
];

let passed = 0;

for (const [name, override, shouldPass] of tests) {
    try {
        validateEligibilityCriteria({
            ...validCriteria,
            ...override,
        });

        if (shouldPass) {
            console.log(`✔ PASSED: ${name}`);
            passed++;
        } else {
            console.log(`✘ FAILED: ${name} (Expected rejection)`);
        }
    } catch (error) {
        if (!shouldPass && error.statusCode === 400) {
            console.log(`✔ PASSED: ${name} (Rejected correctly)`);
            passed++;
        } else {
            console.log(`✘ FAILED: ${name} - ${error.message}`);
        }
    }
}

console.log(`\nResult: ${passed}/${tests.length} tests passed.`);

if (passed !== tests.length) {
    process.exitCode = 1;
}
