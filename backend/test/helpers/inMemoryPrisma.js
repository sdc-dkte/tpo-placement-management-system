// A small in-memory stand-in for the Prisma client, used ONLY by the unit tests.
// It is NOT PostgreSQL: it models the behaviour these tests rely on (unique studentId, transaction rollback, one-step
// updateMany, async interleaving) but real database locking and SQL semantics are not covered by it.
//
// DriveParticipation and PlacementStatusHistory are excluded from V1, so touching either model throws. A test that
// passes therefore proves the selection flow never reads or writes them.

const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value), (key, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(v) ? new Date(v) : v));

class UniqueConstraintError extends Error {
  constructor() { super("Unique constraint failed"); this.code = "P2002"; }
}

const MODELS = ["student", "placementDrive", "studentSelection", "company", "user", "jobRole", "department"];
const EXCLUDED_MODELS = ["driveParticipation", "placementStatusHistory"];
const UNIQUE_COLUMNS = { studentSelection: [["studentId"]] }; // each entry is one unique index

function createInMemoryPrisma(seed) {
  // hooks.createError[model] lets a test make the next inserts fail (e.g. to simulate a database outage).
  const db = { tables: clone(seed), sequences: {}, hooks: { createError: {} } };
  for (const name of MODELS) { db.tables[name] = db.tables[name] || []; db.sequences[name] = Math.max(0, ...db.tables[name].map(row => row.id || 0)); }
  const rows = name => db.tables[name];
  const findById = (name, id) => rows(name).find(row => row.id === id) || null;

  // Attaches related rows so nested where/orderBy (student.department.name, drive.company.id ...) work like Prisma relations.
  function hydrate(name, row) {
    if (!row) return row;
    const out = { ...row };
    if (name === "student") { out.user = findById("user", row.userId); out.department = findById("department", row.departmentId); out.selection = rows("studentSelection").find(s => s.studentId === row.id) || null; }
    if (name === "placementDrive") { out.company = findById("company", row.companyId); out.jobRole = row.jobRoleId ? findById("jobRole", row.jobRoleId) : null; out.eligibilityCriteria = (db.tables.eligibilityCriteria || []).find(c => c.driveId === row.id) || null; out.eligibleBranches = (db.tables.eligibleBranches || []).filter(b => b.driveId === row.id); out.eligibleYears = (db.tables.eligibleYears || []).filter(y => y.driveId === row.id); }
    if (name === "studentSelection") { out.student = hydrate("student", findById("student", row.studentId)); out.drive = hydrate("placementDrive", findById("placementDrive", row.driveId)); }
    return out;
  }

  function matches(row, where) {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (key === "OR") return condition.some(inner => matches(row, inner));
      const current = row[key];
      if (condition && typeof condition === "object" && !(condition instanceof Date)) {
        if ("contains" in condition) return typeof current === "string" && current.toLowerCase().includes(String(condition.contains).toLowerCase());
        if ("in" in condition) return condition.in.includes(current);
        return current != null && matches(current, condition);
      }
      return current === condition;
    });
  }

  const uniqueWhere = where => { const out = {}; for (const [k, v] of Object.entries(where)) Object.assign(out, v && typeof v === "object" && !(v instanceof Date) ? v : { [k]: v }); return out; };
  const orderPath = orderBy => { const path = []; let cursor = orderBy; while (cursor && typeof cursor === "object") { const key = Object.keys(cursor)[0]; path.push(key); cursor = cursor[key]; } return { path, direction: cursor }; };
  const readPath = (object, path) => path.reduce((value, key) => (value == null ? value : value[key]), object);

  function buildModel(name, undoLog) {
    const remember = undo => { if (undoLog) undoLog.push(undo); };
    return {
      async findUnique({ where }) { await tick(); const row = rows(name).find(r => matches(r, uniqueWhere(where))); return row ? hydrate(name, clone(row)) : null; },
      async findMany({ where, orderBy, skip = 0, take } = {}) {
        await tick();
        let result = rows(name).map(r => hydrate(name, clone(r))).filter(r => matches(r, where));
        for (const order of [...(Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [])].reverse()) {
          const { path, direction } = orderPath(order);
          result = [...result].sort((a, b) => { const x = readPath(a, path), y = readPath(b, path); return x === y ? 0 : (x < y ? -1 : 1) * (direction === "asc" ? 1 : -1); });
        }
        return result.slice(skip, take == null ? undefined : skip + take);
      },
      async count({ where } = {}) { await tick(); return rows(name).map(r => hydrate(name, r)).filter(r => matches(r, where)).length; },
      async create({ data }) {
        await tick();
        if (db.hooks.createError[name]) throw db.hooks.createError[name];
        const row = { ...data, id: ++db.sequences[name], createdAt: new Date(), updatedAt: new Date() };
        if (name === "studentSelection") row.selectedAt = new Date();
        const missingParent = name === "studentSelection" && (!findById("student", row.studentId) || !findById("placementDrive", row.driveId));
        if (missingParent) throw Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" });
        for (const columns of UNIQUE_COLUMNS[name] || []) if (rows(name).some(existing => columns.every(c => existing[c] === row[c]))) throw new UniqueConstraintError();
        rows(name).push(row);
        remember(() => rows(name).splice(rows(name).indexOf(row), 1));
        return hydrate(name, clone(row));
      },
      // One synchronous step after the await: check and write happen together, like a single SQL UPDATE ... WHERE.
      async updateMany({ where, data }) {
        await tick();
        const targets = rows(name).filter(r => matches(r, where));
        for (const row of targets) { const before = { ...row }; Object.assign(row, data, { updatedAt: new Date() }); remember(() => Object.assign(row, before)); }
        return { count: targets.length };
      },
    };
  }

  const client = { __db: db };
  for (const name of MODELS) client[name] = buildModel(name, null);
  for (const name of EXCLUDED_MODELS) client[name] = new Proxy({}, { get: (_t, method) => () => { throw new Error(`V1 must not use ${name}.${String(method)}()`); } });
  client.$transaction = async callback => {
    const undoLog = [];
    const tx = {};
    for (const name of MODELS) tx[name] = buildModel(name, undoLog);
    for (const name of EXCLUDED_MODELS) tx[name] = client[name];
    try { return await callback(tx); } catch (e) { for (const undo of undoLog.reverse()) undo(); throw e; }
  };
  return client;
}

module.exports = { createInMemoryPrisma };