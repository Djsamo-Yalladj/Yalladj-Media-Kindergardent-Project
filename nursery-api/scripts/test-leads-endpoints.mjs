// End-to-end smoke test for /api/leads (index.ts) and /api/leads/[id].ts.
// Exercises CREATE → LIST → GET → PATCH → DELETE → verify 404 on deleted.
// Invokes handlers directly with mocked req/res — no network layer.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: listCreateHandler } = await import('../api/leads/index.ts');
const { default: byIdHandler } = await import('../api/leads/[id].ts');

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

const uniqueEmail = `smoketest+${Date.now()}@yalladj.test`;

// 1. CREATE
console.log('1. POST /api/leads');
let res = mockRes();
await listCreateHandler(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryName: 'Smoke Test Nursery',
      contactName: 'Test Contact',
      email: uniqueEmail,
      phone: '+971500000000',
      country: 'UAE',
      city: 'Dubai',
      source: 'smoke_test',
      budget: 12500.5,
      packageInterest: 'standard',
      notes: 'Created by test-leads-endpoints.mjs',
      intakeData: { foo: 'bar', children: 42 },
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body?.ok === true, 'expected ok:true');
const createdId = res.body.data.id;
console.log('   created id:', createdId);

// 2. LIST with search filter
console.log('2. GET /api/leads?search=Smoke');
res = mockRes();
await listCreateHandler(
  { method: 'GET', query: { search: 'Smoke', limit: '10' }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 match');
assert(
  res.body.data.rows.some((r) => r.id === createdId),
  'created lead missing from list',
);
console.log('   total matching:', res.body.data.total);

// 3. GET by id
console.log('3. GET /api/leads/:id');
res = mockRes();
await byIdHandler(
  { method: 'GET', query: { id: createdId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.email === uniqueEmail, 'email mismatch on fetch');

// 4. PATCH
console.log('4. PATCH /api/leads/:id (status=contacted, notes updated)');
res = mockRes();
await byIdHandler(
  {
    method: 'PATCH',
    query: { id: createdId },
    headers: {},
    body: { status: 'contacted', notes: 'updated by smoke test' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.status === 'contacted', 'status not updated');
assert(res.body.data.notes === 'updated by smoke test', 'notes not updated');

// 5. validation failure
console.log('5. POST /api/leads with bad email (expect 400)');
res = mockRes();
await listCreateHandler(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { nurseryName: 'x', contactName: 'y', email: 'not-an-email' },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'validation_failed', 'expected validation_failed');

// 6. DELETE (soft)
console.log('6. DELETE /api/leads/:id');
res = mockRes();
await byIdHandler(
  { method: 'DELETE', query: { id: createdId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.deleted === true, 'expected deleted:true');

// 7. GET deleted → 404
console.log('7. GET /api/leads/:id (deleted, expect 404)');
res = mockRes();
await byIdHandler(
  { method: 'GET', query: { id: createdId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`);

// 8. method not allowed
console.log('8. PUT /api/leads (expect 405)');
res = mockRes();
await listCreateHandler({ method: 'PUT', query: {}, headers: {}, body: {} }, res);
assert(res.statusCode === 405, `expected 405, got ${res.statusCode}`);

console.log('\nAll 8 checks passed ✅');
