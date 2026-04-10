// End-to-end smoke test for projects + nested spec + stages routes.
// Creates a parent nursery, then exercises:
//   1. POST   /api/projects
//   2. GET    /api/projects?nurseryId=...
//   3. GET    /api/projects/:id
//   4. PATCH  /api/projects/:id  (stage change → stage history grows)
//   5. GET    /api/projects/:id/stages
//   6. PUT    /api/projects/:id/spec  (upsert create)
//   7. PUT    /api/projects/:id/spec  (upsert update + approved:true)
//   8. GET    /api/projects/:id/spec
//   9. POST   /api/projects with bad nurseryId → 400
//  10. DELETE /api/projects/:id  → 200
//  11. GET    /api/projects/:id  → 404
// Cleans up parent nursery at the end.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: nurseryListCreate } = await import('../api/nurseries/index.ts');
const { default: nurseryById } = await import('../api/nurseries/[id].ts');
const { default: projectListCreate } = await import('../api/projects/index.ts');
const { default: projectById } = await import('../api/projects/[id].ts');
const { default: projectSpec } = await import('../api/projects/[id]/spec.ts');
const { default: projectStages } = await import('../api/projects/[id]/stages.ts');

function mockRes() {
  const r = {
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
  return r;
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const stamp = Date.now();

// Setup: create parent nursery
console.log('setup: create parent nursery');
let res = mockRes();
await nurseryListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { name: 'Parent Nursery', slug: `smoke-parent-${stamp}` },
  },
  res,
);
assert(res.statusCode === 201, `nursery create failed: ${JSON.stringify(res.body)}`);
const nurseryId = res.body.data.id;
console.log('   parent nursery:', nurseryId);

// 1. POST /api/projects
console.log('1. POST /api/projects');
res = mockRes();
await projectListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId,
      name: 'Smoke Project',
      slug: `smoke-project-${stamp}`,
      packageType: 'standard',
      contractValue: 7500,
      description: { en: 'Test', ar: 'اختبار' },
      notes: 'created by smoke test',
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.stage === 'lead', 'expected initial stage lead');
const projectId = res.body.data.id;
console.log('   project id:', projectId);

// 2. LIST by nurseryId
console.log('2. GET /api/projects?nurseryId=...');
res = mockRes();
await projectListCreate(
  { method: 'GET', query: { nurseryId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 project');

// 3. GET by id
console.log('3. GET /api/projects/:id');
res = mockRes();
await projectById(
  { method: 'GET', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// 4. PATCH stage change: lead → design
console.log('4. PATCH /api/projects/:id stage=design');
res = mockRes();
await projectById(
  {
    method: 'PATCH',
    query: { id: projectId },
    headers: {},
    body: { stage: 'design', progressPercent: 25, stageChangeNotes: 'kicked off design' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.stage === 'design', 'stage not updated');
assert(res.body.data.progressPercent === 25, 'progressPercent not updated');

// Second stage change: design → launched (should stamp launchedAt automatically)
console.log('4b. PATCH /api/projects/:id stage=launched');
res = mockRes();
await projectById(
  {
    method: 'PATCH',
    query: { id: projectId },
    headers: {},
    body: { stage: 'launched', progressPercent: 100 },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.launchedAt !== null, 'launchedAt should auto-stamp');

// 5. GET stage history — should have 3 entries (lead, design, launched)
console.log('5. GET /api/projects/:id/stages');
res = mockRes();
await projectStages(
  { method: 'GET', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total === 3, `expected 3 stage records, got ${res.body.data.total}`);
// Newest first
assert(res.body.data.rows[0].stage === 'launched', 'latest stage should be launched');
assert(res.body.data.rows[0].exitedAt === null, 'latest stage should be open');
assert(res.body.data.rows[1].stage === 'design', 'second stage should be design');
assert(res.body.data.rows[1].exitedAt !== null, 'design stage should be closed');
assert(res.body.data.rows[2].stage === 'lead', 'third stage should be lead');
assert(res.body.data.rows[2].exitedAt !== null, 'lead stage should be closed');
console.log('   stage history OK (3 records, 2 closed, 1 open)');

// 6. PUT spec (create)
console.log('6. PUT /api/projects/:id/spec (create)');
res = mockRes();
await projectSpec(
  {
    method: 'PUT',
    query: { id: projectId },
    headers: {},
    body: {
      brandColors: { primary: '#ffc136' },
      pages: [{ slug: 'home', title_en: 'Home' }],
      features: ['booking', 'gallery'],
      briefEn: 'Build a nursery site',
      claudeCodeStatus: 'brief_ready',
    },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.claudeCodeStatus === 'brief_ready', 'status not set');
assert(res.body.data.approvedAt === null, 'approvedAt should be null before approval');

// 7. PUT spec (update with approved:true)
console.log('7. PUT /api/projects/:id/spec (update + approve)');
res = mockRes();
await projectSpec(
  {
    method: 'PUT',
    query: { id: projectId },
    headers: {},
    body: { approved: true, claudeCodeStatus: 'in_progress' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.approvedAt !== null, 'approvedAt should be stamped');
assert(res.body.data.claudeCodeStatus === 'in_progress', 'status not updated');
// Original fields from step 6 should still exist (upsert update merges).
assert(res.body.data.briefEn === 'Build a nursery site', 'briefEn lost on update');

// 8. GET spec
console.log('8. GET /api/projects/:id/spec');
res = mockRes();
await projectSpec(
  { method: 'GET', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data !== null, 'spec should exist');

// 9. POST with bad nurseryId
console.log('9. POST /api/projects with bad nurseryId (expect 400)');
res = mockRes();
await projectListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
      name: 'x',
      slug: `smoke-bad-${stamp}`,
      packageType: 'starter',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_nursery', 'expected invalid_nursery');

// 10. DELETE project
console.log('10. DELETE /api/projects/:id');
res = mockRes();
await projectById(
  { method: 'DELETE', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// 11. GET deleted → 404
console.log('11. GET deleted project → 404');
res = mockRes();
await projectById(
  { method: 'GET', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`);

// Cleanup: delete parent nursery
console.log('cleanup: delete parent nursery');
res = mockRes();
await nurseryById(
  { method: 'DELETE', query: { id: nurseryId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup nursery delete failed');

console.log('\nAll 11 checks passed ✅');
