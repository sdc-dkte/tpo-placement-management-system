
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
const selectionRouter = require(path.join(srcDir, "routes/selection.routes"));
const studentRouter = require(path.join(srcDir, "routes/student.routes"));
const mounts = [["/api/v1/selections", selectionRouter], ["/api/v1/students", studentRouter]];

// ------------------------------------------------------------------ seed data
const day = 24 * 60 * 60 * 1000;
const makeSeed = () => ({
  user: [{ id: 1, name: "TPO", email: "tpo@x.edu", role: "TPO" }, ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 10 + n, name: `Student ${n}`, email: `s${n}@x.edu`, role: "STUDENT" }))],
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
test.beforeEach(() => { const client = createInMemoryPrisma(makeSeed()); for (const key of Object.keys(prismaRef)) delete prismaRef[key]; Object.assign(prismaRef, client); db = client.__db; });

// ------------------------------------------------------------------ tiny request dispatcher (real Express routers, no HTTP)
const tokenFor = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET);
const TPO = tokenFor(1, "TPO");
const studentToken = n => tokenFor(10 + n, "STUDENT");
const toRegex = pattern => new RegExp("^" + pattern.replace(/:[^/]+/g, "([^/]+)") + "/?$");

function findLayers(method, url) {
  const found = [];
  for (const [prefix, router] of mounts) for (const layer of router.stack) {
    if (!layer.route || !layer.route.methods[method.toLowerCase()]) continue;
    const full = prefix + (layer.route.path === "/" ? "" : layer.route.path);
    if (toRegex(full).test(url)) found.push({ layer, full });
  }
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
    const handlers = match.layer.route.stack.map(entry => entry.handle);
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
const createSelection = (body, token = TPO) => request("POST", "/api/v1/selections", { token, body });
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

test("route registration: no participation, participation-history or placements endpoints are exposed", () => {
  const forbidden = ["/api/v1/drives/1/participations", "/api/v1/participations/1", "/api/v1/participations/1/history", "/api/v1/participations/1/status", "/api/v1/placements", "/api/v1/placements/1", "/api/v1/students/me/placements"];
  for (const method of ["GET", "POST", "PATCH"]) for (const url of forbidden) assert.equal(findLayers(method, url).length, 0, `${method} ${url} must not be registered`);
});

test("route registration: server.js mounts only the selection and student routers for this module, and the removed files are gone", () => {
  const server = fs.readFileSync(path.join(srcDir, "server.js"), "utf8");
  assert.match(server, /app\.use\("\/api\/v1\/selections", selectionRoutes\)/);
  assert.match(server, /app\.use\("\/api\/v1\/students", studentRoutes\)/);
  assert.doesNotMatch(server, /participation|placement\.routes|placementRoutes|\/placements/i);
  for (const removed of ["routes/participation.routes.js", "controllers/participation.controller.js", "routes/placement.routes.js", "controllers/placement.controller.js"]) assert.equal(fs.existsSync(path.join(srcDir, removed)), false, `${removed} should be removed`);
});

test("the excluded Prisma models are still declared in the schema (found next to src if the prisma folder is present)", t => {
  const candidates = [path.join(__dirname, "../prisma/schema.prisma"), path.join(__dirname, "../../prisma/schema.prisma")];
  const schemaPath = candidates.find(fs.existsSync);
  if (!schemaPath) return t.skip("schema.prisma not found relative to this test");
  const schema = fs.readFileSync(schemaPath, "utf8");
  assert.match(schema, /model DriveParticipation \{/);
  assert.match(schema, /model PlacementStatusHistory \{/);
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

test("package falls back to the drive's package when packageLPA is omitted", async () => {
  const res = await createSelection({ studentId: 1, driveId: 1 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.packageLPA, 10);
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

test.todo("inactive student is rejected: schema.prisma has no active flag on Student or User (isActive exists only on Company), so this rule cannot be implemented or tested until the team defines one");

test("inactive company and a job role from another company are rejected with 422", async () => {
  assert.equal((await createSelection({ studentId: 1, driveId: 5 })).body.error.code, "COMPANY_INACTIVE");
  assert.equal((await createSelection({ studentId: 1, driveId: 6 })).body.error.code, "JOB_ROLE_COMPANY_MISMATCH");
});

// ------------------------------------------------------------------ 7. eligibility
test("ineligible student -> 422 NOT_ELIGIBLE with reasons, nothing stored", async () => {
  const res = await createSelection({ studentId: 2, driveId: 1 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, "NOT_ELIGIBLE");
  assert.ok(res.body.error.details.some(d => d.message === "MINIMUM_CGPA_NOT_MET"));
  assert.equal(db.tables.studentSelection.length, 0);
});

test("eligibility is recalculated from current data each time, not from a stored flag", async () => {
  assert.equal((await createSelection({ studentId: 2, driveId: 1 })).status, 422);
  db.tables.student.find(s => s.id === 2).CGPA = 9; // the student's academic record is corrected
  assert.equal((await createSelection({ studentId: 2, driveId: 1 })).status, 201);
  db.tables.student.find(s => s.id === 6).activeBacklogs = 3; // ...and another student's record gets worse
  assert.equal((await createSelection({ studentId: 6, driveId: 1 })).body.error.code, "NOT_ELIGIBLE");
});

test("eligibility rules still apply: backlogs, department-restricted drives, drive without criteria", async () => {
  assert.ok((await createSelection({ studentId: 5, driveId: 1 })).body.error.details.some(d => d.message === "MAXIMUM_BACKLOGS_EXCEEDED"));
  db.tables.eligibleBranches.push({ driveId: 2, departmentId: 1 });
  assert.ok((await createSelection({ studentId: 4, driveId: 2 })).body.error.details.some(d => d.message === "DEPARTMENT_NOT_ELIGIBLE"));
  assert.ok((await createSelection({ studentId: 1, driveId: 7 })).body.error.details.some(d => d.message === "ELIGIBILITY_CRITERIA_NOT_CONFIGURED"));
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
  const orphan = await request("GET", "/api/v1/students/me/selection", { token: tokenFor(999, "STUDENT") });
  assert.equal(orphan.status, 404);
});