// Run with: node --test backend/tests/selection.controller.test.js   (Node 18+; needs express + jsonwebtoken, which the project already has)
//
// These are MOCK-BASED unit tests: prismaClient is replaced by an in-memory stand-in (tests/helpers/inMemoryPrisma.js).
// They exercise the real routers, the real auth/role middleware and the real controllers, but NOT PostgreSQL.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.env.JWT_SECRET = "test-secret";
const jwt = require("jsonwebtoken");
const { createInMemoryPrisma } = require("./helpers/inMemoryPrisma");

const srcDir = path.join(__dirname, "../src");
const prismaPath = require.resolve(path.join(srcDir, "prismaClient"));
const prismaRef = {};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaRef };
// Spy on the real rule engine (calls through to it) so the tests can verify the arguments the controller passes and the result it uses.
const eligibilityService = require(path.join(srcDir, "services/eligibility.service"));
const eligibilityCalls = [];
const realEvaluateStudentEligibility = eligibilityService.evaluateStudentEligibility;
eligibilityService.evaluateStudentEligibility = (...args) => { const result = realEvaluateStudentEligibility(...args); eligibilityCalls.push({ args, result }); return result; };
const selectionRouter = require(path.join(srcDir, "routes/selection.routes"));
const studentRouter = require(path.join(srcDir, "routes/student.routes"));
const mounts = [["/api/v1/selections", selectionRouter], ["/api/v1/students", studentRouter]];

// ------------------------------------------------------------------ seed data
const day = 24 * 60 * 60 * 1000;
const makeSeed = () => ({
  user: [{ id: 1, name: "TPO", email: "tpo@x.edu", role: "TPO", isActive: true }, ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 10 + n, name: `Student ${n}`, email: `s${n}@x.edu`, role: "STUDENT", isActive: true }))],
  department: [{ id: 1, name: "Computer", code: "CS" }, { id: 2, name: "Mechanical", code: "ME" }],
  student: [
    { id: 1, userId: 11, PRN: "PRN001", departmentId: 1, graduationYear: 2026, academicPathway: "HSC", CGPA: 8.5, tenthPercentage: 85, twelfthPercentage: 80, diplomaPercentage: null, activeBacklogs: 0 },
    { id: 2, userId: 12, PRN: "PRN002", departmentId: 1, graduationYear: 2026, academicPathway: "HSC", CGPA: 6.0, tenthPercentage: 85, twelfthPercentage: 80, diplomaPercentage: null, activeBacklogs: 0 },
    { id: 3, userId: 13, PRN: "PRN003", departmentId: 1, graduationYear: 2025, academicPathway: "DIPLOMA", CGPA: 9.0, tenthPercentage: 90, twelfthPercentage: null, diplomaPercentage: 75, activeBacklogs: 0 },
    { id: 4, userId: 14, PRN: "PRN004", departmentId: 2, graduationYear: 2026, academicPathway: "HSC", CGPA: 9.0, tenthPercentage: 90, twelfthPercentage: 90, diplomaPercentage: null, activeBacklogs: 0 },
    { id: 5, userId: 15, PRN: "PRN005", departmentId: 1, graduationYear: 2026, academicPathway: "HSC", CGPA: 8.0, tenthPercentage: 70, twelfthPercentage: 70, diplomaPercentage: null, activeBacklogs: 2 },
    { id: 6, userId: 16, PRN: "PRN006", departmentId: 1, graduationYear: 2026, academicPathway: "HSC", CGPA: 7.5, tenthPercentage: 70, twelfthPercentage: 70, diplomaPercentage: null, activeBacklogs: 0 },
  ],
  company: [{ id: 1, name: "Acme", website: "acme.com", isActive: true }, { id: 2, name: "Dormant", website: null, isActive: false }, { id: 3, name: "Beta", website: "beta.com", isActive: true }],
  jobRole: [{ id: 1, title: "SDE", companyId: 1, description: "Build", domain: "IT" }, { id: 2, title: "Dormant role", companyId: 2 }, { id: 3, title: "Analyst", companyId: 3, description: "Analyse", domain: "Data" }],
  placementDrive: [
    { id: 1, title: "Acme SDE", status: "UPCOMING", companyId: 1, jobRoleId: 1, packageLPA: 10, driveDate: new Date(Date.now() + day) },
    { id: 2, title: "Beta Analyst", status: "ONGOING", companyId: 3, jobRoleId: 3, packageLPA: 8, driveDate: null },
    { id: 3, title: "Cancelled drive", status: "CANCELLED", companyId: 1, jobRoleId: 1, packageLPA: 5 },
    { id: 4, title: "Completed drive", status: "COMPLETED", companyId: 1, jobRoleId: 1, packageLPA: 6 },
    { id: 5, title: "Dormant company drive", status: "UPCOMING", companyId: 2, jobRoleId: 2, packageLPA: 5 },
    { id: 6, title: "Role of another company", status: "UPCOMING", companyId: 3, jobRoleId: 1, packageLPA: 5 },
    { id: 7, title: "No criteria", status: "UPCOMING", companyId: 1, jobRoleId: 1, packageLPA: 5 },
  ],
  eligibilityCriteria: [
    { driveId: 1, minimumCGPA: 7, minimumTenth: 60, minimumTwelfth: 60, minimumDiplomaPercentage: 60, maximumBacklogs: 0, allowPreviousPlacement: false },
    ...[2, 3, 4, 5, 6].map(driveId => ({ driveId, minimumCGPA: 0, minimumTenth: 0, minimumTwelfth: null, minimumDiplomaPercentage: null, maximumBacklogs: 9, allowPreviousPlacement: true })),
  ],
  eligibleBranches: [], eligibleYears: [], studentSelection: [],
});

let db;
const transactionReads = [];
const txHooks = {}; // a test can run code just before the transaction reads a model, to simulate another request committing in between
test.beforeEach(() => {
  eligibilityCalls.length = 0;
  transactionReads.length = 0;
  for (const key of Object.keys(txHooks)) delete txHooks[key];
  const client = createInMemoryPrisma(makeSeed());
  for (const key of Object.keys(prismaRef)) delete prismaRef[key];
  Object.assign(prismaRef, client);
  db = client.__db;
  // Wrap $transaction so reads made through the transaction client are recorded with their arguments.
  prismaRef.$transaction = callback => client.$transaction(tx => {
    const record = (model) => ({ ...tx[model], findUnique: args => { transactionReads.push({ model, args }); if (txHooks[model]) txHooks[model](); return tx[model].findUnique(args); } });
    return callback({ ...tx, student: record("student"), placementDrive: record("placementDrive") });
  });
});

// ------------------------------------------------------------------ tiny request dispatcher (real Express routers, no HTTP)
const tokenFor = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET);
const TPO = tokenFor(1, "TPO");
const studentToken = n => tokenFor(10 + n, "STUDENT");
const toRegex = pattern => new RegExp("^" + pattern.replace(/:[^/]+/g, "([^/]+)") + "/?$");

function findLayers(method, url) {
  const found = [];
  for (const [prefix, router] of mounts) router.stack.forEach((layer, position) => {
    if (!layer.route || !layer.route.methods[method.toLowerCase()]) return;
    const full = prefix + (layer.route.path === "/" ? "" : layer.route.path);
    if (toRegex(full).test(url)) found.push({ layer, full, router, position });
  });
  return found;
}

async function request(method, url, { token, body, query = {} } = {}) {
  const [match] = findLayers(method, url);
  if (!match) return { status: 404, body: { noRoute: true } };
  const values = url.match(toRegex(match.full)).slice(1);
  const params = Object.fromEntries([...match.full.matchAll(/:([^/]+)/g)].map((m, i) => [m[1], values[i]]));
  const req = { method, params, query, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
  return new Promise(resolve => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(payload) { resolve({ status: this.code, body: payload }); return this; } };
    // Router-level middleware such as router.use(authenticate) runs first, exactly as Express would run it.
    const routerMiddleware = match.router.stack.slice(0, match.position).filter(layer => !layer.route).map(layer => layer.handle);
    const handlers = [...routerMiddleware, ...match.layer.route.stack.map(entry => entry.handle)];
    let index = 0;
    const next = err => {
      if (err) return resolve({ status: 500, body: { error: String(err) } });
      const handler = handlers[index++];
      if (!handler) return;
      Promise.resolve(handler(req, res, next)).catch(e => resolve({ status: 500, body: { thrown: String(e) } }));
    };
    next();
  });
}
// packageLPA is required by the API, so the everyday helper supplies a valid one unless the test passes its own (or uses the raw helper).
const createSelection = (body, token = TPO) => request("POST", "/api/v1/selections", { token, body: { packageLPA: 10, ...body } });
const createSelectionRaw = (body, token = TPO) => request("POST", "/api/v1/selections", { token, body });
const seedSelection = (studentId, driveId, status = "SELECTED", packageLPA = 10, offsetSeconds = 0) => {
  const row = { id: ++db.sequences.studentSelection, studentId, driveId, status, packageLPA, selectedAt: new Date(Date.now() + offsetSeconds * 1000), createdAt: new Date(), updatedAt: new Date() };
  db.tables.studentSelection.push(row);
  return row;
};
const quietly = async fn => { const original = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = original; } };

// ------------------------------------------------------------------ 15. route registration
test("route registration: the five V1 selection endpoints exist exactly once with the right roles", () => {
  const expected = [
    ["POST", "/api/v1/selections", "TPO"], ["GET", "/api/v1/selections", "TPO"], ["GET", "/api/v1/selections/1", "TPO"],
    ["PATCH", "/api/v1/selections/1/status", "TPO"], ["GET", "/api/v1/students/me/selection", "STUDENT"],
  ];
  for (const [method, url] of expected) assert.equal(findLayers(method, url).length, 1, `${method} ${url} must be registered exactly once`);
});

test("route registration: GET /students/me/selection is not swallowed by GET /students/:studentId", () => {
  const [match] = findLayers("GET", "/api/v1/students/me/selection");
  assert.equal(match.full, "/api/v1/students/me/selection");
});

test("route registration: existing student APIs are untouched (each route path is still registered exactly once)", () => {
  const registeredCount = (method, fullPath) => mounts.flatMap(([prefix, router]) => router.stack
    .filter(layer => layer.route && layer.route.methods[method.toLowerCase()])
    .map(layer => prefix + (layer.route.path === "/" ? "" : layer.route.path))).filter(full => full === fullPath).length;
  for (const fullPath of ["/api/v1/students", "/api/v1/students/:studentId", "/api/v1/students/me", "/api/v1/students/me/drives", "/api/v1/students/me/placements", "/api/v1/students/me/selection"]) assert.equal(registeredCount("GET", fullPath), 1, `GET ${fullPath} must be registered exactly once`);
  for (const [method, fullPath] of [["POST", "/api/v1/students"], ["PATCH", "/api/v1/students/:studentId"], ["PATCH", "/api/v1/students/:id/status"]]) assert.equal(registeredCount(method, fullPath), 1, `${method} ${fullPath} must be registered exactly once`);
});

test("route registration: the selection and student routers expose no participation or participation-history endpoints", () => {
  for (const method of ["GET", "POST", "PATCH"]) for (const url of ["/api/v1/drives/1/participations", "/api/v1/participations/1", "/api/v1/participations/1/history", "/api/v1/participations/1/status"]) assert.equal(findLayers(method, url).length, 0, `${method} ${url} must not be registered`);
});

test("selection APIs do not depend on participation records or recruitment-stage statuses (source check)", () => {
  for (const file of ["controllers/selection.controller.js", "routes/selection.routes.js"]) {
    const code = fs.readFileSync(path.join(srcDir, file), "utf8").split("\n").filter(line => !line.trim().startsWith("//")).join("\n");
    assert.doesNotMatch(code, /participation|placementStatusHistory|SHORTLISTED|INTERVIEW_SCHEDULED|processStatus/i, `${file} must not reference participations or recruitment stages`);
  }
});

test("server.js registers the selection routes exactly once", () => {
  const server = fs.readFileSync(path.join(srcDir, "server.js"), "utf8");
  assert.equal((server.match(/^\s*app\.use\("\/api\/v1\/selections",\s*selectionRoutes\)/gm) || []).length, 1);
  assert.equal((server.match(/^\s*const selectionRoutes = require\("\.\/routes\/selection\.routes"\)/gm) || []).length, 1);
});

test("the excluded Prisma models are still declared in the schema (found next to src if the prisma folder is present)", t => {
  const candidates = [path.join(__dirname, "../prisma/schema.prisma"), path.join(__dirname, "../../prisma/schema.prisma")];
  const schemaPath = candidates.find(fs.existsSync);
  if (!schemaPath) return t.skip("schema.prisma not found relative to this test");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.match(schema, /model DriveParticipation \{/);
  assert.match(schema, /model PlacementStatusHistory \{/);
});

test("the controller only imports names that eligibility.service.js really exports", () => {
  const service = require(path.join(srcDir, "services/eligibility.service"));
  const source = fs.readFileSync(path.join(srcDir, "controllers/selection.controller.js"), "utf8");
  const imported = source.match(/const \{([^}]+)\} = require\("\.\.\/services\/eligibility\.service"\)/)[1].split(",").map(name => name.trim());
  assert.ok(imported.length > 0);
  for (const name of imported) assert.equal(typeof service[name], "function", `eligibility.service.js does not export ${name}()`);
});

// ------------------------------------------------------------------ 3. authorization
test("authorization: no token -> 401 on every selection endpoint", async () => {
  for (const [method, url] of [["POST", "/api/v1/selections"], ["GET", "/api/v1/selections"], ["GET", "/api/v1/selections/1"], ["PATCH", "/api/v1/selections/1/status"], ["GET", "/api/v1/students/me/selection"]]) assert.equal((await request(method, url, { body: {} })).status, 401, `${method} ${url}`);
});

test("authorization: a STUDENT token gets 403 on create, list, detail and status update", async () => {
  const token = studentToken(1);
  for (const [method, url] of [["POST", "/api/v1/selections"], ["GET", "/api/v1/selections"], ["GET", "/api/v1/selections/1"], ["PATCH", "/api/v1/selections/1/status"]]) assert.equal((await request(method, url, { token, body: { studentId: 1, driveId: 1, status: "OFFER_ACCEPTED" } })).status, 403, `${method} ${url}`);
  assert.equal(db.tables.studentSelection.length, 0);
});

test("authorization: a TPO token gets 403 on GET /students/me/selection", async () => {
  assert.equal((await request("GET", "/api/v1/students/me/selection", { token: TPO })).status, 403);
});

// ------------------------------------------------------------------ 1, 2. direct creation
test("creates a selection directly: no DriveParticipation, no PlacementStatusHistory (touching either model throws)", async () => {
  const res = await createSelection({ studentId: 1, driveId: 1, packageLPA: 12.5 });
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Student selection recorded successfully");
  assert.deepEqual({ studentId: res.body.data.studentId, driveId: res.body.data.driveId, status: res.body.data.status, packageLPA: res.body.data.packageLPA }, { studentId: 1, driveId: 1, status: "SELECTED", packageLPA: 12.5 });
  assert.equal(db.tables.studentSelection.length, 1);
  assert.equal(db.tables.driveParticipation, undefined);
  assert.equal(db.tables.placementStatusHistory, undefined);
});

test("packageLPA is required: omitted, undefined and null are all rejected with 400 and the drive's package is NOT used as a fallback", async () => {
  for (const body of [{ studentId: 1, driveId: 1 }, { studentId: 1, driveId: 1, packageLPA: undefined }, { studentId: 1, driveId: 1, packageLPA: null }]) {
    const res = await createSelectionRaw(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(res.body.error.details[0].field, "packageLPA");
  }
  assert.equal(db.tables.studentSelection.length, 0);
  assert.equal(eligibilityCalls.length, 0);
});

test("a completed or ongoing drive is a valid target; a cancelled drive is not", async () => {
  assert.equal((await createSelection({ studentId: 1, driveId: 4 })).status, 201);
  assert.equal((await createSelection({ studentId: 4, driveId: 2 })).status, 201);
  const cancelled = await createSelection({ studentId: 6, driveId: 3 });
  assert.equal(cancelled.status, 422);
  assert.equal(cancelled.body.error.code, "DRIVE_CLOSED");
});

// ------------------------------------------------------------------ 5, 6. missing student/drive, inactive student
test("missing student -> 404 and missing drive -> 404", async () => {
  const noStudent = await createSelection({ studentId: 999, driveId: 1 });
  const noDrive = await createSelection({ studentId: 1, driveId: 999 });
  assert.equal(noStudent.status, 404); assert.equal(noStudent.body.error.code, "STUDENT_NOT_FOUND");
  assert.equal(noDrive.status, 404); assert.equal(noDrive.body.error.code, "DRIVE_NOT_FOUND");
});

test("inactive student (User.isActive = false) -> 422 STUDENT_INACTIVE, nothing stored; re-activated student can be selected", async () => {
  db.tables.user.find(u => u.id === 11).isActive = false;
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "STUDENT_INACTIVE");
  assert.equal(db.tables.studentSelection.length, 0);
  db.tables.user.find(u => u.id === 11).isActive = true;
  assert.equal((await createSelection({ studentId: 1, driveId: 1 })).status, 201);
});

test("a student deactivated AFTER the first check but before the transaction read is still rejected: 422 STUDENT_INACTIVE, nothing stored", async () => {
  // The first (pre-transaction) check sees an active user; the account is switched off just before the transaction re-reads it.
  txHooks.student = () => { db.tables.user.find(u => u.id === 11).isActive = false; delete txHooks.student; };
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "STUDENT_INACTIVE");
  assert.equal(db.tables.studentSelection.length, 0);
  assert.equal(eligibilityCalls.length, 0, "the rule engine must not run for an inactive student");
});

test("an inactive student does not block other, active students", async () => {
  db.tables.user.find(u => u.id === 11).isActive = false;
  assert.equal((await createSelection({ studentId: 3, driveId: 2 })).status, 201);
});

test("inactive company and a job role from another company are rejected with 422", async () => {
  assert.equal((await createSelection({ studentId: 1, driveId: 5 })).body.error.code, "COMPANY_INACTIVE");
  assert.equal((await createSelection({ studentId: 1, driveId: 6 })).body.error.code, "JOB_ROLE_COMPANY_MISMATCH");
});

// ------------------------------------------------------------------ 7. eligibility
test("ineligible student -> 422 NOT_ELIGIBLE with reasons, nothing stored", async () => {
  const res = await createSelection({ studentId: 2, driveId: 1 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "NOT_ELIGIBLE");
  assert.ok(res.body.error.details.some(d => /CGPA .* below the required minimum of 7/.test(d.message)), JSON.stringify(res.body.error.details));
  assert.equal(db.tables.studentSelection.length, 0);
});

test("eligibility is recalculated from current data each time, not from a stored flag", async () => {
  assert.equal((await createSelection({ studentId: 2, driveId: 1 })).status, 422);
  db.tables.student.find(s => s.id === 2).CGPA = 9; // the student's academic record is corrected
  assert.equal((await createSelection({ studentId: 2, driveId: 1 })).status, 201);
  db.tables.student.find(s => s.id === 6).activeBacklogs = 3; // ...and another student's record gets worse
  assert.equal((await createSelection({ studentId: 6, driveId: 1 })).body.error.code, "NOT_ELIGIBLE");
});

test("eligibility rules still apply (current eligibility.service.js): backlogs, department-restricted drives, drive without criteria", async () => {
  assert.ok((await createSelection({ studentId: 5, driveId: 1 })).body.error.details.some(d => /Active backlogs \(2\) exceed the maximum allowed \(0\)/.test(d.message)));
  db.tables.eligibleBranches.push({ driveId: 2, departmentId: 1 });
  assert.ok((await createSelection({ studentId: 4, driveId: 2 })).body.error.details.some(d => /department is not eligible/.test(d.message)));
  // The shared service applies only branch/year rules when a drive has no EligibilityCriteria row (it does not reject the student).
  assert.equal((await createSelection({ studentId: 1, driveId: 7 })).status, 201);
});

// ------------------------------------------------------------------ eligibility call contract (verified against eligibility.service.js)
test("evaluateStudentEligibility is called as (student, criteria, branchIds[], years[]) and its { isEligible, reasons } result is used", async () => {
  db.tables.eligibleBranches.push({ driveId: 1, departmentId: 1 }, { driveId: 1, departmentId: 2 });
  db.tables.eligibleYears.push({ driveId: 1, graduationYear: 2026 });
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 201);
  assert.equal(eligibilityCalls.length, 1);
  const { args, result } = eligibilityCalls[0];
  assert.equal(args.length, 4);
  const [student, criteria, branchIds, years] = args;
  // every student field the rule engine reads is present, plus the selection relation it uses for the single-offer policy
  for (const field of ["id", "departmentId", "graduationYear", "academicPathway", "CGPA", "tenthPercentage", "twelfthPercentage", "diplomaPercentage", "activeBacklogs", "selection"]) assert.ok(field in student, `student.${field} must be passed to the rule engine`);
  assert.equal(student.id, 1);
  assert.equal(student.selection, null);
  // criteria is the drive's EligibilityCriteria row; branch ids and years are plain number arrays
  for (const field of ["minimumCGPA", "minimumTenth", "minimumTwelfth", "minimumDiplomaPercentage", "maximumBacklogs", "allowPreviousPlacement"]) assert.ok(field in criteria, `criteria.${field}`);
  assert.deepEqual([...branchIds].sort(), [1, 2]);
  assert.deepEqual(years, [2026]);
  assert.ok(branchIds.every(Number.isInteger) && years.every(Number.isInteger));
  // return value shape the controller relies on
  assert.equal(typeof result.isEligible, "boolean");
  assert.ok(Array.isArray(result.reasons));
  assert.equal(result.isEligible, true);
});

test("the rule engine's inputs are read INSIDE the transaction, with the relations it needs (selection, criteria, branches, years)", async () => {
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 201);
  const studentRead = transactionReads.find(read => read.model === "student");
  const driveRead = transactionReads.find(read => read.model === "placementDrive");
  assert.ok(studentRead && driveRead, "student and drive must be re-read through the transaction client");
  assert.equal(studentRead.args.include.selection, true);
  assert.deepEqual(studentRead.args.include.user, { select: { isActive: true } }, "the account status is re-checked inside the transaction");
  assert.equal(studentRead.args.select, undefined, "a select would drop the scalar fields the rule engine reads");
  assert.deepEqual(driveRead.args.include, { eligibilityCriteria: true, eligibleBranches: true, eligibleYears: true });
});

test("an ineligible result from the rule engine is honoured: 422 NOT_ELIGIBLE carries exactly the engine's reasons", async () => {
  const res = await createSelection({ studentId: 2, driveId: 1 });
  assert.equal(res.status, 422);
  assert.equal(eligibilityCalls.length, 1);
  assert.equal(eligibilityCalls[0].result.isEligible, false);
  assert.deepEqual(res.body.error.details.map(d => d.message), eligibilityCalls[0].result.reasons);
  assert.ok(res.body.error.details.every(d => d.field === "eligibility"));
});

test("a drive with no EligibilityCriteria row passes criteria = null to the rule engine and does not crash", async () => {
  const res = await createSelection({ studentId: 1, driveId: 7 });
  assert.equal(res.status, 201);
  assert.equal(eligibilityCalls[0].args[1], null);
});

test("the rule engine is not even called when an earlier check fails (bad package, missing student, missing drive, inactive student, duplicate)", async () => {
  await createSelection({ studentId: 1, driveId: 1, packageLPA: true });
  await createSelection({ studentId: 999, driveId: 1 });
  await createSelection({ studentId: 1, driveId: 999 });
  db.tables.user.find(u => u.id === 11).isActive = false;
  await createSelection({ studentId: 1, driveId: 1 });
  db.tables.user.find(u => u.id === 11).isActive = true;
  seedSelection(1, 1);
  await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(eligibilityCalls.length, 0);
});

// ------------------------------------------------------------------ 8. packageLPA validation
const invalidPackages = [
  ["true", true], ["false", false], ["null", null], ["empty string", ""], ["blank string", "   "], ["text", "abc"], ["12abc", "12abc"], ["1e3", "1e3"], ["0x10", "0x10"], ["-5 string", "-5"],
  ["object", {}], ["array", []], ["array [10]", [10]], ["NaN", NaN], ["Infinity", Infinity], ["-Infinity", -Infinity], ["1e999", Number("1e999")], ["zero", 0], ["zero string", "0"], ["negative", -1],
];
for (const [label, value] of invalidPackages) {
  test(`invalid packageLPA ${label} -> 400 VALIDATION_ERROR, nothing stored`, async () => {
    const res = await createSelection({ studentId: 1, driveId: 1, packageLPA: value });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.equal(res.body.error.details[0].field, "packageLPA");
    assert.equal(db.tables.studentSelection.length, 0);
  });
}
for (const [input, stored] of [[12, 12], [12.5, 12.5], [0.01, 0.01], ["12.5", 12.5], [" 9.75 ", 9.75]]) {
  test(`valid packageLPA ${JSON.stringify(input)} is stored as the number ${stored}`, async () => {
    const res = await createSelection({ studentId: 1, driveId: 1, packageLPA: input });
    assert.equal(res.status, 201);
    assert.equal(typeof db.tables.studentSelection[0].packageLPA, "number");
    assert.equal(db.tables.studentSelection[0].packageLPA, stored);
  });
}
test("malformed ids -> 400", async () => {
  for (const body of [{}, { studentId: "a", driveId: 1 }, { studentId: [1], driveId: 1 }, { studentId: true, driveId: 1 }, { studentId: 1, driveId: 0 }, { studentId: 1.5, driveId: 1 }]) assert.equal((await createSelection(body)).status, 400, JSON.stringify(body));
  assert.equal((await request("POST", "/api/v1/selections", { token: TPO, body: undefined })).status, 400);
});

// ------------------------------------------------------------------ 9, 10. duplicates and concurrency
test("duplicate selection for the same student -> 409, still exactly one record (also for a different drive)", async () => {
  assert.equal((await createSelection({ studentId: 1, driveId: 1 })).status, 201);
  const sameDrive = await createSelection({ studentId: 1, driveId: 1 });
  const otherDrive = await createSelection({ studentId: 1, driveId: 2 });
  assert.equal(sameDrive.status, 409); assert.equal(sameDrive.body.error.code, "OFFICIAL_SELECTION_EXISTS");
  assert.equal(otherDrive.status, 409);
  assert.equal(db.tables.studentSelection.length, 1);
});

test("concurrent duplicate requests for the same student and drive -> exactly one 201, the rest 409, one record", async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => createSelection({ studentId: 1, driveId: 1 })));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 5);
  assert.equal(db.tables.studentSelection.length, 1);
});

test("concurrent requests selecting one student for two different drives -> one winner", async () => {
  const results = await Promise.all([createSelection({ studentId: 1, driveId: 1 }), createSelection({ studentId: 1, driveId: 2 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  assert.equal(db.tables.studentSelection.length, 1);
});

test("unique-constraint error (P2002) raised by the database at insert time is a clean 409, not a 500", async () => {
  db.hooks.createError.studentSelection = Object.assign(new Error("unique"), { code: "P2002" });
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "OFFICIAL_SELECTION_EXISTS");
});

test("unexpected database failure -> 500 with a generic message and no record", async () => {
  db.hooks.createError.studentSelection = new Error("connection lost");
  const res = await quietly(() => createSelection({ studentId: 1, driveId: 1 }));
  assert.equal(res.status, 500);
  assert.equal(res.body.error.code, "INTERNAL_ERROR");
  assert.equal(db.tables.studentSelection.length, 0);
});

// ------------------------------------------------------------------ 11, 12, 13. detail and offer status
test("detail returns student, drive, company, job role, package and status; missing -> 404; bad id -> 400", async () => {
  const row = seedSelection(1, 1, "SELECTED", 11);
  const ok = await request("GET", `/api/v1/selections/${row.id}`, { token: TPO });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.PRN, "PRN001");
  assert.equal(ok.body.data.company.name, "Acme");
  assert.equal(ok.body.data.jobRole.title, "SDE");
  assert.equal(ok.body.data.drive.title, "Acme SDE");
  assert.equal(ok.body.data.packageLPA, 11);
  assert.equal(ok.body.data.status, "SELECTED");
  assert.equal((await request("GET", "/api/v1/selections/999", { token: TPO })).status, 404);
  assert.equal((await request("GET", "/api/v1/selections/abc", { token: TPO })).status, 400);
});

test("status update: missing selection -> 404; invalid status -> 400; bad id -> 400", async () => {
  const row = seedSelection(1, 1);
  assert.equal((await request("PATCH", "/api/v1/selections/999/status", { token: TPO, body: { status: "OFFER_ACCEPTED" } })).status, 404);
  for (const status of ["BOGUS", "", null, undefined, 5, ["OFFER_ACCEPTED"], "offer_accepted"]) assert.equal((await request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status } })).status, 400, JSON.stringify(status));
  assert.equal((await request("PATCH", "/api/v1/selections/abc/status", { token: TPO, body: { status: "OFFER_ACCEPTED" } })).status, 400);
  assert.equal(db.tables.studentSelection[0].status, "SELECTED");
});

for (const status of ["OFFER_ACCEPTED", "OFFER_DECLINED"]) {
  test(`status update to ${status} succeeds and the selection record is kept`, async () => {
    const row = seedSelection(1, 1);
    const res = await request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, status);
    assert.equal(db.tables.studentSelection.length, 1);
    assert.equal(db.tables.studentSelection[0].status, status);
    assert.equal((await request("GET", `/api/v1/selections/${row.id}`, { token: TPO })).body.data.status, status);
  });
}

test("a declined selection still counts: the student cannot be selected again (one official selection per student)", async () => {
  const row = seedSelection(1, 1);
  await request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status: "OFFER_DECLINED" } });
  assert.equal((await createSelection({ studentId: 1, driveId: 2 })).status, 409);
});

test("final statuses cannot be changed again (422); repeating the same status is a harmless no-op", async () => {
  const row = seedSelection(1, 1, "OFFER_ACCEPTED");
  assert.equal((await request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status: "OFFER_DECLINED" } })).status, 422);
  assert.equal((await request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status: "OFFER_ACCEPTED" } })).status, 200);
});

test("accept and decline racing each other: exactly one wins", async () => {
  const row = seedSelection(1, 1);
  const results = await Promise.all(["OFFER_ACCEPTED", "OFFER_DECLINED"].map(status => request("PATCH", `/api/v1/selections/${row.id}/status`, { token: TPO, body: { status } })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.ok(results.some(r => r.status === 409));
});

// ------------------------------------------------------------------ 14. list: pagination and filters
const seedListData = () => {
  seedSelection(1, 1, "SELECTED", 10, 1);          // CS 2026 Acme
  seedSelection(3, 2, "OFFER_ACCEPTED", 8, 2);     // CS 2025 Beta
  seedSelection(4, 2, "OFFER_DECLINED", 20, 3);    // ME 2026 Beta
  seedSelection(6, 4, "SELECTED", 6, 4);           // CS 2026 Acme (completed drive)
};
const list = query => request("GET", "/api/v1/selections", { token: TPO, query });

test("list: returns flattened rows with pagination, newest first", async () => {
  seedListData();
  const res = await list({});
  assert.equal(res.status, 200);
  assert.equal(res.body.pagination.total, 4);
  assert.deepEqual(res.body.data.map(r => r.PRN), ["PRN006", "PRN004", "PRN003", "PRN001"]);
  assert.deepEqual(Object.keys(res.body.data[0]).sort(), ["PRN", "company", "companyId", "department", "driveId", "graduationYear", "jobRole", "packageLPA", "selectedAt", "selectionId", "status", "studentId", "studentName"]);
});

test("list: pagination (limit/page/totalPages) and validation", async () => {
  seedListData();
  const second = await list({ limit: "3", page: "2" });
  assert.equal(second.body.data.length, 1);
  assert.deepEqual(second.body.pagination, { page: 2, limit: 3, total: 4, totalPages: 2 });
  for (const query of [{ page: "0" }, { page: "x" }, { limit: "0" }, { limit: "101" }, { limit: "1.5" }]) assert.equal((await list(query)).status, 400, JSON.stringify(query));
});

test("list: filters by department, graduation year, company, drive and status", async () => {
  seedListData();
  const prns = async query => (await list(query)).body.data.map(r => r.PRN).sort().join();
  assert.equal(await prns({ departmentId: "2" }), "PRN004");
  assert.equal(await prns({ graduationYear: "2025" }), "PRN003");
  assert.equal(await prns({ companyId: "3" }), "PRN003,PRN004");
  assert.equal(await prns({ driveId: "4" }), "PRN006");
  assert.equal(await prns({ status: "OFFER_ACCEPTED" }), "PRN003");
  assert.equal(await prns({ departmentId: "1", graduationYear: "2026", status: "SELECTED" }), "PRN001,PRN006");
  assert.equal(await prns({ departmentId: "999" }), "");
});

test("list: search by PRN, student name, company and job role", async () => {
  seedListData();
  const count = async search => (await list({ search })).body.data.length;
  assert.equal(await count("prn001"), 1);
  assert.equal(await count("student 3"), 1);
  assert.equal(await count("beta"), 2);
  assert.equal(await count("analyst"), 2);
  assert.equal(await count("   "), 4);
});

test("list: sorting works and unsafe or unknown sort/filter values -> 400", async () => {
  seedListData();
  assert.deepEqual((await list({ sortBy: "packageLPA", sortOrder: "asc" })).body.data.map(r => r.packageLPA), [6, 8, 10, 20]);
  assert.deepEqual((await list({ sortBy: "studentName", sortOrder: "asc" })).body.data.map(r => r.PRN), ["PRN001", "PRN003", "PRN004", "PRN006"]);
  for (const query of [{ sortBy: "passwordHash" }, { sortBy: "constructor" }, { sortOrder: "sideways" }, { status: "BOGUS" }, { departmentId: "x" }, { companyId: "1.5" }, { driveId: "0" }, { graduationYear: "20x6" }, { graduationYear: "1800" }, { departmentId: ["1"] }, { search: ["a"] }]) assert.equal((await list(query)).status, 400, JSON.stringify(query));
});

// ------------------------------------------------------------------ 4. a student sees only their own selection
test("student sees only their own selection and never anyone else's", async () => {
  seedSelection(1, 1, "SELECTED", 10);
  seedSelection(3, 2, "OFFER_ACCEPTED", 8);
  const mine = await request("GET", "/api/v1/students/me/selection", { token: studentToken(1) });
  const other = await request("GET", "/api/v1/students/me/selection", { token: studentToken(3) });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.data.studentId, 1);
  assert.equal(mine.body.data.company.name, "Acme");
  assert.equal(mine.body.data.packageLPA, 10);
  assert.equal(other.body.data.studentId, 3);
  assert.equal(other.body.data.status, "OFFER_ACCEPTED");
});

test("a client-supplied studentId (query or body) is ignored", async () => {
  seedSelection(1, 1, "SELECTED", 10);
  seedSelection(3, 2, "OFFER_ACCEPTED", 8);
  const res = await request("GET", "/api/v1/students/me/selection", { token: studentToken(1), query: { studentId: "3" }, body: { studentId: 3 } });
  assert.equal(res.body.data.studentId, 1);
});

test("student with no selection gets 200 with data null; a student account without a student profile gets 404", async () => {
  const none = await request("GET", "/api/v1/students/me/selection", { token: studentToken(2) });
  assert.equal(none.status, 200);
  assert.equal(none.body.data, null);
  // A real, active STUDENT login that has no Student profile. The user row exists so an auth middleware that looks the user up in the database still lets the request through.
  db.tables.user.push({ id: 99, name: "No Profile", email: "np@x.edu", role: "STUDENT", isActive: true, mustChangePassword: false });
  const orphan = await request("GET", "/api/v1/students/me/selection", { token: tokenFor(99, "STUDENT") });
  assert.equal(orphan.status, 404);
});

// ------------------------------------------------------------------ 16. OPTIONAL: real PostgreSQL (skipped unless TEST_DATABASE_URL is set)
// Run against a THROWAWAY, fully migrated database (never production):
//   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/tpo_test node --test backend/tests/selection.controller.test.js
// It uses the real Prisma client and the real controller, creates its own rows (unique suffix) and deletes them afterwards.
const realDatabaseUrl = process.env.TEST_DATABASE_URL;
test("REAL POSTGRES: 8 simultaneous POST /selections for one student -> exactly one 201, the rest 409, exactly one row; inactive student -> 422", { skip: !realDatabaseUrl && "set TEST_DATABASE_URL to run against PostgreSQL" }, async () => {
  const { PrismaClient } = require("@prisma/client");
  const real = new PrismaClient({ datasources: { db: { url: realDatabaseUrl } } });
  const suffix = `${Date.now()}`;
  const created = {};
  try {
    // Route the controller's prismaClient at the real client (beforeEach installed the in-memory one).
    for (const key of ["student", "placementDrive", "studentSelection", "user", "company", "jobRole", "department"]) prismaRef[key] = real[key];
    prismaRef.$transaction = (...args) => real.$transaction(...args);

    created.department = await real.department.create({ data: { name: `Dept ${suffix}`, code: `D${suffix}`.slice(0, 12) } });
    created.tpo = await real.user.create({ data: { name: "TPO", email: `tpo-${suffix}@test.local`, passwordHash: "x", role: "TPO" } });
    created.userA = await real.user.create({ data: { name: "A", email: `a-${suffix}@test.local`, passwordHash: "x", role: "STUDENT" } });
    created.userB = await real.user.create({ data: { name: "B", email: `b-${suffix}@test.local`, passwordHash: "x", role: "STUDENT" } });
    created.studentA = await real.student.create({ data: { userId: created.userA.id, PRN: `A${suffix}`, departmentId: created.department.id, graduationYear: 2026, academicPathway: "HSC" } });
    created.studentB = await real.student.create({ data: { userId: created.userB.id, PRN: `B${suffix}`, departmentId: created.department.id, graduationYear: 2026, academicPathway: "HSC" } });
    created.company = await real.company.create({ data: { name: `Co ${suffix}` } });
    created.jobRole = await real.jobRole.create({ data: { companyId: created.company.id, title: "SDE" } });
    created.drive = await real.placementDrive.create({ data: { companyId: created.company.id, jobRoleId: created.jobRole.id, title: `Drive ${suffix}`, packageLPA: 10 } }); // no criteria row = no restriction
    const token = tokenFor(created.tpo.id, "TPO");

    const results = await quietly(() => Promise.all(Array.from({ length: 8 }, () => request("POST", "/api/v1/selections", { token, body: { studentId: created.studentA.id, driveId: created.drive.id, packageLPA: 10 } }))));
    const statuses = results.map(r => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409], JSON.stringify(results.map(r => r.body.error || r.status)));
    assert.ok(results.filter(r => r.status === 409).every(r => r.body.error.code === "OFFICIAL_SELECTION_EXISTS"));
    assert.equal(await real.studentSelection.count({ where: { studentId: created.studentA.id } }), 1);

    await real.user.update({ where: { id: created.userB.id }, data: { isActive: false } });
    const inactive = await createSelection({ studentId: created.studentB.id, driveId: created.drive.id }, token);
    assert.equal(inactive.status, 422);
    assert.equal(inactive.body.error.code, "STUDENT_INACTIVE");
    assert.equal(await real.studentSelection.count({ where: { studentId: created.studentB.id } }), 0);
  } finally {
    await real.studentSelection.deleteMany({ where: { driveId: created.drive?.id ?? -1 } }).catch(() => {});
    if (created.drive) await real.placementDrive.delete({ where: { id: created.drive.id } }).catch(() => {});
    if (created.jobRole) await real.jobRole.delete({ where: { id: created.jobRole.id } }).catch(() => {});
    if (created.company) await real.company.delete({ where: { id: created.company.id } }).catch(() => {});
    for (const s of [created.studentA, created.studentB]) if (s) await real.student.delete({ where: { id: s.id } }).catch(() => {});
    for (const u of [created.userA, created.userB, created.tpo]) if (u) await real.user.delete({ where: { id: u.id } }).catch(() => {});
    if (created.department) await real.department.delete({ where: { id: created.department.id } }).catch(() => {});
    await real.$disconnect();
  }
});