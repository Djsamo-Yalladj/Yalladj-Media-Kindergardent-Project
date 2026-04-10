// A3.8 smoke test: audit_logs append-only helper.
//
// Exercises recordAudit() via real endpoint handlers and asserts that each
// mutation writes a matching audit_logs row with the expected action,
// entity_table, entity_id, actor defaults, captured IP/User-Agent, and
// before/after snapshot shape.
//
// Scenarios:
//   1. Lead: create → update → delete → 3 audit rows, correct actions
//   2. Nursery + Project: create project, change stage → project.stage_changed
//      with metadata.stageFrom/stageTo; delete → project.deleted
//   3. Encrypted setting: value must be redacted in both `after` and `metadata.patch`
//   4. Actor defaults to "system" when no auth; IP/UA captured from req headers
//   5. Audit helper swallows errors — hand it a malformed action string that
//      would still succeed (audit logs accept any string, so instead we verify
//      that throwing inside a mutation does NOT write a bogus audit row)
//
// Uses prisma directly for assertions on audit_logs (no public API exposes it).

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { default: leadListCreate } = await import('../api/leads/index.ts');
const { default: leadById } = await import('../api/leads/[id].ts');
const { default: nurseryListCreate } = await import('../api/nurseries/index.ts');
const { default: nurseryById } = await import('../api/nurseries/[id].ts');
const { default: projectListCreate } = await import('../api/projects/index.ts');
const { default: projectById } = await import('../api/projects/[id].ts');
const { default: settingListCreate } = await import('../api/settings/index.ts');
const { default: settingById } = await import('../api/settings/[id].ts');

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader() {
      return this;
    },
  };
}

function mockReq(method, { query = {}, body = undefined, headers = {} } = {}) {
  return {
    method,
    query,
    headers: {
      'user-agent': 'audit-smoke-test/1.0',
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
    body,
  };
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed += 1;
}

async function latestAudit(filter) {
  const row = await prisma.auditLog.findFirst({
    where: filter,
    orderBy: { createdAt: 'desc' },
  });
  assert(row !== null, `expected audit row matching ${JSON.stringify(filter)}`);
  return row;
}

// ------------------------------------------------------------------
// Scenario 1: Lead create → update → delete
// ------------------------------------------------------------------
console.log('Scenario 1: lead CRUD → 3 audit rows');

let res = mockRes();
await leadListCreate(
  mockReq('POST', {
    body: {
      nurseryName: 'Audit Smoke Lead',
      contactName: 'Audit Contact',
      email: `audit+${Date.now()}@yalladj.test`,
      country: 'UAE',
      city: 'Dubai',
    },
  }),
  res,
);
assert(res.statusCode === 201, `lead create expected 201, got ${res.statusCode}`);
const leadId = res.body.data.id;

let row = await latestAudit({ entityTable: 'leads', entityId: leadId });
assert(row.action === 'lead.created', `expected lead.created, got ${row.action}`);
assert(row.actorType === 'system', `expected actorType=system, got ${row.actorType}`);
assert(row.actorId === null, 'expected actorId=null');
assert(row.ipAddress === '203.0.113.7', `expected ipAddress=203.0.113.7, got ${row.ipAddress}`);
assert(
  row.userAgent === 'audit-smoke-test/1.0',
  `expected userAgent=audit-smoke-test/1.0, got ${row.userAgent}`,
);
assert(row.entityLabel === 'Audit Smoke Lead', `entityLabel mismatch: ${row.entityLabel}`);
assert(
  row.changes && row.changes.after && row.changes.after.id === leadId,
  'expected changes.after to contain created lead',
);

res = mockRes();
await leadById(
  mockReq('PATCH', { query: { id: leadId }, body: { status: 'contacted', notes: 'audit update' } }),
  res,
);
assert(res.statusCode === 200, `lead patch expected 200, got ${res.statusCode}`);
row = await latestAudit({ entityTable: 'leads', entityId: leadId, action: 'lead.updated' });
assert(
  row.changes && row.changes.before && row.changes.after,
  'expected lead.updated changes to have before and after',
);
assert(
  row.changes.before.status === 'new' && row.changes.after.status === 'contacted',
  `expected status transition new→contacted in changes, got ${row.changes.before.status}→${row.changes.after.status}`,
);
assert(
  row.metadata && row.metadata.patch && row.metadata.patch.notes === 'audit update',
  'expected patch to be captured in metadata',
);

res = mockRes();
await leadById(mockReq('DELETE', { query: { id: leadId } }), res);
assert(res.statusCode === 200, `lead delete expected 200, got ${res.statusCode}`);
row = await latestAudit({ entityTable: 'leads', entityId: leadId, action: 'lead.deleted' });
assert(
  row.changes && row.changes.before && row.changes.before.id === leadId,
  'expected deleted audit to capture full before snapshot',
);

// ------------------------------------------------------------------
// Scenario 2: Project stage change → project.stage_changed
// ------------------------------------------------------------------
console.log('Scenario 2: project.stage_changed audit row');

const slugSuffix = Date.now();
res = mockRes();
await nurseryListCreate(
  mockReq('POST', {
    body: {
      name: 'Audit Nursery',
      slug: `audit-nursery-${slugSuffix}`,
      email: `audit+nursery+${slugSuffix}@yalladj.test`,
      country: 'UAE',
      city: 'Dubai',
      packageType: 'standard',
      contactName: 'x',
    },
  }),
  res,
);
assert(res.statusCode === 201, `nursery create expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
const nurseryId = res.body.data.id;

res = mockRes();
await projectListCreate(
  mockReq('POST', {
    body: {
      nurseryId,
      name: 'Audit Project',
      slug: `audit-project-${slugSuffix}`,
      packageType: 'standard',
    },
  }),
  res,
);
assert(res.statusCode === 201, `project create expected 201, got ${res.statusCode}`);
const projectId = res.body.data.id;

row = await latestAudit({ entityTable: 'projects', entityId: projectId });
assert(row.action === 'project.created', `expected project.created, got ${row.action}`);
assert(row.metadata && row.metadata.initialStage === 'lead', 'expected initialStage=lead in metadata');

res = mockRes();
await projectById(
  mockReq('PATCH', { query: { id: projectId }, body: { stage: 'design', stageChangeNotes: 'smoke' } }),
  res,
);
assert(res.statusCode === 200, `project patch expected 200, got ${res.statusCode}`);
row = await latestAudit({
  entityTable: 'projects',
  entityId: projectId,
  action: 'project.stage_changed',
});
assert(
  row.metadata && row.metadata.stageFrom === 'lead' && row.metadata.stageTo === 'design',
  `expected stageFrom=lead, stageTo=design, got ${JSON.stringify(row.metadata)}`,
);

res = mockRes();
await projectById(mockReq('DELETE', { query: { id: projectId } }), res);
assert(res.statusCode === 200, `project delete expected 200`);
row = await latestAudit({ entityTable: 'projects', entityId: projectId, action: 'project.deleted' });
assert(row.entityLabel === 'Audit Project', 'expected entityLabel cached');

res = mockRes();
await nurseryById(mockReq('DELETE', { query: { id: nurseryId } }), res);
assert(res.statusCode === 200, 'nursery delete expected 200');

// ------------------------------------------------------------------
// Scenario 3: Encrypted setting → value redacted in audit
// ------------------------------------------------------------------
console.log('Scenario 3: encrypted setting value redacted');

const settingKey = `audit.secret.${Date.now()}`;
res = mockRes();
await settingListCreate(
  mockReq('POST', {
    body: {
      key: settingKey,
      value: { token: 'super-secret-value' },
      category: 'secrets',
      label: 'Audit Secret',
      isEncrypted: true,
    },
  }),
  res,
);
assert(res.statusCode === 201, `setting create expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
const settingId = res.body.data.id;

row = await latestAudit({ entityTable: 'settings', entityId: settingId, action: 'setting.created' });
assert(
  row.changes && row.changes.after && row.changes.after.value === '[redacted]',
  `expected redacted value in setting.created audit, got ${JSON.stringify(row.changes?.after?.value)}`,
);

res = mockRes();
await settingById(
  mockReq('PATCH', {
    query: { id: settingId },
    body: { value: { token: 'another-secret' }, label: 'Audit Secret v2' },
  }),
  res,
);
assert(res.statusCode === 200, `setting patch expected 200, got ${res.statusCode}`);
row = await latestAudit({ entityTable: 'settings', entityId: settingId, action: 'setting.updated' });
assert(
  row.changes.before.value === '[redacted]' && row.changes.after.value === '[redacted]',
  'expected both before and after values redacted',
);
assert(
  row.metadata && row.metadata.patch && row.metadata.patch.value === '[redacted]',
  `expected metadata.patch.value redacted, got ${JSON.stringify(row.metadata?.patch)}`,
);
assert(
  row.metadata.patch.label === 'Audit Secret v2',
  'non-secret fields in patch should NOT be redacted',
);

res = mockRes();
await settingById(mockReq('DELETE', { query: { id: settingId } }), res);
assert(res.statusCode === 200, 'setting delete expected 200');

// ------------------------------------------------------------------
// Scenario 4: Validation failure does NOT write an audit row
// ------------------------------------------------------------------
console.log('Scenario 4: failed mutation writes no audit row');

const beforeCount = await prisma.auditLog.count({
  where: { entityTable: 'leads' },
});

res = mockRes();
await leadListCreate(
  mockReq('POST', {
    body: { nurseryName: 'x', contactName: 'y', email: 'not-an-email' },
  }),
  res,
);
assert(res.statusCode === 400, `expected validation 400, got ${res.statusCode}`);

const afterCount = await prisma.auditLog.count({
  where: { entityTable: 'leads' },
});
assert(
  afterCount === beforeCount,
  `failed create should not write audit row; count went ${beforeCount}→${afterCount}`,
);

// ------------------------------------------------------------------
// Scenario 5: audit_logs is append-only — no updatedAt column, never deleted
// ------------------------------------------------------------------
console.log('Scenario 5: audit_logs rows never mutate');

const sample = await prisma.auditLog.findFirst({
  where: { entityTable: 'leads' },
  orderBy: { createdAt: 'desc' },
});
assert(sample !== null, 'expected at least one audit row from prior scenarios');
assert(!('updatedAt' in sample), 'audit_logs should not expose an updatedAt field');
assert(!('deletedAt' in sample), 'audit_logs should not be soft-deletable');

console.log(`\nAll ${passed} audit checks passed ✅`);
