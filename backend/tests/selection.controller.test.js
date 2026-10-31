// Run with: node --test backend/tests/   (Node 18+, no database needed: prismaClient is replaced by an in-memory stub)
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const prismaPath = require.resolve(path.join(__dirname, "../src/prismaClient"));
const prismaStub = {};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };
const { createSelection } = require("../src/controllers/selection.controller");

// Builds an in-memory database. updateMany behaves like one SQL "UPDATE ... WHERE": check and write happen together.
function setUpDatabase({ participationStatus = "SHORTLISTED", drivePackage = 10, afterFirstParticipationRead = null } = {}) {
  const state = {
    participation: { id: 7, studentId: 1, driveId: 1, processStatus: participationStatus, updatedAt: new Date(0) },
    selections: [],
    calls: [],
    participationReads: 0,
  };
  const drive = {
    id: 1, status: "UPCOMING", companyId: 1, packageLPA: drivePackage,
    company: { id: 1, name: "Acme", isActive: true },
    jobRole: { id: 1, title: "SDE", companyId: 1 },
    eligibilityCriteria: { minimumCGPA: 7, minimumTenth: 60, minimumTwelfth: 60, minimumDiplomaPercentage: null, maximumBacklogs: 0, allowPreviousPlacement: false },
    eligibleBranches: [], eligibleYears: [],
  };
  const student = { id: 1, departmentId: 1, graduationYear: 2026, academicPathway: "HSC", CGPA: 8, tenthPercentage: 80, twelfthPercentage: 80, diplomaPercentage: null, activeBacklogs: 0, selection: null };

  const database = {
    student: { findUnique: async () => ({ ...student }) },
    placementDrive: { findUnique: async () => ({ ...drive }) },
    studentSelection: {
      findUnique: async () => state.selections[0] || null,
      create: async ({ data }) => { state.calls.push("selection.create"); const row = { id: 1, ...data }; state.selections.push(row); return row; },
    },
    driveParticipation: {
      findUnique: async () => {
        const snapshot = { ...state.participation };
        state.participationReads += 1;
        // Simulates another TPO changing the status right after this transaction has read it.
        if (afterFirstParticipationRead && state.participationReads === 2) afterFirstParticipationRead(state);
        return snapshot;
      },
      updateMany: async args => {
        state.calls.push("participation.updateMany");
        state.lastUpdateArgs = args;
        const row = state.participation;
        const matches = row.id === args.where.id && row.processStatus === args.where.processStatus;
        if (matches) Object.assign(row, args.data);
        return { count: matches ? 1 : 0 };
      },
    },
    // Rolls back the selection insert when the callback throws, like a real transaction.
    $transaction: async callback => {
      const selectionsBefore = [...state.selections];
      try { return await callback(database); } catch (e) { state.selections = selectionsBefore; throw e; }
    },
  };
  Object.assign(prismaStub, database);
  return state;
}

const call = async body => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
  await createSelection({ body, user: { id: 1, role: "TPO" } }, res);
  return res;
};
const quietly = async fn => { const original = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = original; } };

// ---------------------------------------------------------------- concurrency
test("selection succeeds: participation is locked with a conditional update BEFORE the selection is created", async () => {
  const state = setUpDatabase();
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(state.calls, ["participation.updateMany", "selection.create"]);
  assert.deepEqual(state.lastUpdateArgs.where, { id: 7, processStatus: "SHORTLISTED" }); // id AND the exact status that was read
});

test("the conditional update never writes the previously read status back", async () => {
  const state = setUpDatabase();
  await call({ studentId: 1, driveId: 1 });
  assert.equal("processStatus" in state.lastUpdateArgs.data, false);
});

test("another TPO rejects the student after the read -> 409, no selection, REJECTED is not overwritten", async () => {
  const state = setUpDatabase({ afterFirstParticipationRead: s => { s.participation.processStatus = "REJECTED"; } });
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, "CONCURRENT_UPDATE");
  assert.equal(state.selections.length, 0);
  assert.equal(state.participation.processStatus, "REJECTED");
  assert.equal(state.calls.includes("selection.create"), false);
});

test("another TPO moves SHORTLISTED -> INTERVIEW_SCHEDULED after the read -> 409 (stale status is not accepted either)", async () => {
  const state = setUpDatabase({ afterFirstParticipationRead: s => { s.participation.processStatus = "INTERVIEW_SCHEDULED"; } });
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 409);
  assert.equal(state.participation.processStatus, "INTERVIEW_SCHEDULED");
  assert.equal(state.selections.length, 0);
});

test("participation already REJECTED when the transaction reads it -> 422 and nothing is written", async () => {
  const state = setUpDatabase({ participationStatus: "REJECTED" });
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 422);
  assert.equal(state.calls.length, 0);
});

test("unique-constraint violation (P2002) on insert -> 409 OFFICIAL_SELECTION_EXISTS", async () => {
  const state = setUpDatabase();
  prismaStub.studentSelection.create = async () => { throw Object.assign(new Error("unique"), { code: "P2002" }); };
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, "OFFICIAL_SELECTION_EXISTS");
  assert.equal(state.selections.length, 0);
});

test("unexpected database error -> 500 and no selection", async () => {
  const state = setUpDatabase();
  prismaStub.driveParticipation.updateMany = async () => { throw new Error("connection lost"); };
  const res = await quietly(() => call({ studentId: 1, driveId: 1 }));
  assert.equal(res.statusCode, 500);
  assert.equal(state.selections.length, 0);
});

// ---------------------------------------------------------------- packageLPA validation
const invalidValues = [
  ["boolean true", true], ["boolean false", false], ["null", null], ["empty string", ""], ["blank string", "   "],
  ["text", "abc"], ["number with text", "12abc"], ["exponent string", "1e3"], ["hex string", "0x10"], ["negative string", "-5"],
  ["comma decimal", "12,5"], ["object", {}], ["object with value", { value: 10 }], ["array", []], ["array with number", [10]],
  ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["zero", 0], ["zero string", "0"], ["negative number", -1],
  ["overflowing number (1e999 from JSON)", Number("1e999")],
];
for (const [label, value] of invalidValues) {
  test(`packageLPA ${label} -> 400 VALIDATION_ERROR and the database is never touched`, async () => {
    const state = setUpDatabase();
    const res = await call({ studentId: 1, driveId: 1, packageLPA: value });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(res.body.error.details[0].field, "packageLPA");
    assert.equal(state.calls.length, 0);
    assert.equal(state.participationReads, 0);
  });
}

const validValues = [["integer", 12, 12], ["decimal", 12.5, 12.5], ["tiny positive boundary", 0.01, 0.01], ["very large", 1000000, 1000000], ["numeric string", "12.5", 12.5], ["integer string", "8", 8], ["padded string", " 9.75 ", 9.75]];
for (const [label, input, stored] of validValues) {
  test(`packageLPA ${label} (${JSON.stringify(input)}) is accepted and stored as the number ${stored}`, async () => {
    const state = setUpDatabase();
    const res = await call({ studentId: 1, driveId: 1, packageLPA: input });
    assert.equal(res.statusCode, 201);
    assert.equal(typeof state.selections[0].packageLPA, "number");
    assert.equal(state.selections[0].packageLPA, stored);
  });
}

test("packageLPA missing -> falls back to the drive's package", async () => {
  const state = setUpDatabase({ drivePackage: 10 });
  const res = await call({ studentId: 1, driveId: 1 });
  assert.equal(res.statusCode, 201);
  assert.equal(state.selections[0].packageLPA, 10);
});

test("existing validations still apply: bad ids -> 400, non-SELECTED status -> 422", async () => {
  setUpDatabase();
  assert.equal((await call({ studentId: "a", driveId: 1 })).statusCode, 400);
  assert.equal((await call({ studentId: [1], driveId: 1 })).statusCode, 400);
  assert.equal((await call({ studentId: 1, driveId: 1, status: "OFFER_ACCEPTED" })).statusCode, 422);
});