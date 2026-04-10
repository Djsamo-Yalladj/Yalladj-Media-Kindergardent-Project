// End-to-end smoke test for /api/nurseries (index.ts) and /api/nurseries/[id].ts.
// Exercises CREATE → LIST → GET → PATCH → slug-collision → DELETE → 404 → 405.
// Invokes handlers directly with mocked req/res — no network layer.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { default: listCreateHandler } = await import('../api/nurseries/index.ts');
const { default: byIdHandler } = await import('../api/nurseries/[id].ts');

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
const uniqueSlug = `smoke-nursery-${stamp}`;
const uniqueSlug2 = `smoke-nursery-${stamp}-b`;

// 1. CREATE
console.log('1. POST /api/nurseries');
let res = mockRes();
await listCreateHandler(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      name: 'Smoke Test Nursery',
      nameAr: 'حضانة اختبار',
      slug: uniqueSlug,
      email: `smoke+${stamp}@yalladj.test`,
      phone: '+971500000000',
      country: 'UAE',
      city: 'Dubai',
      packageType: 'standard',
      contractValue: 5000,
      brandColors: { primary: '#ffc136', secondary: '#000000' },
      description: { en: 'Test nursery', ar: 'حضانة اختبار' },
      tags: ['smoke', 'test'],
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
const createdId = res.body.data.id;
console.log('   created id:', createdId);

// 2. LIST with search + tag
console.log('2. GET /api/nurseries?search=Smoke&tag=smoke');
res = mockRes();
await listCreateHandler(
  { method: 'GET', query: { search: 'Smoke', tag: 'smoke', limit: '10' }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 match');
assert(
  res.body.data.rows.some((r) => r.id === createdId),
  'created nursery missing from list',
);
console.log('   total matching:', res.body.data.total);

// 3. GET by id
console.log('3. GET /api/nurseries/:id');
res = mockRes();
await byIdHandler(
  { method: 'GET', query: { id: createdId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.slug === uniqueSlug, 'slug mismatch on fetch');

// 4. PATCH
console.log('4. PATCH /api/nurseries/:id (packageType=premium, add tag)');
res = mockRes();
await byIdHandler(
  {
    method: 'PATCH',
    query: { id: createdId },
    headers: {},
    body: { packageType: 'premium', tags: ['smoke', 'test', 'updated'], city: 'Abu Dhabi' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.packageType === 'premium', 'packageType not updated');
assert(res.body.data.city === 'Abu Dhabi', 'city not updated');
assert(res.body.data.tags.includes('updated'), 'tags not updated');

// 5. validation failure — bad slug
console.log('5. POST with bad slug (expect 400)');
res = mockRes();
await listCreateHandler(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { name: 'x', slug: 'Bad Slug With Spaces' },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'validation_failed', 'expected validation_failed');

// 6. slug collision — create second nursery, then try to PATCH first one to same slug
console.log('6. POST second nursery, then PATCH first to collide (expect 409)');
res = mockRes();
await listCreateHandler(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { name: 'Second', slug: uniqueSlug2 },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}`);
const secondId = res.body.data.id;

res = mockRes();
await byIdHandler(
  {
    method: 'PATCH',
    query: { id: createdId },
    headers: {},
    body: { slug: uniqueSlug2 },
  },
  res,
);
assert(res.statusCode === 409, `expected 409, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.error === 'slug_taken', 'expected slug_taken');

// 7. DELETE (soft) both
console.log('7. DELETE both nurseries');
for (const id of [createdId, secondId]) {
  res = mockRes();
  await byIdHandler(
    { method: 'DELETE', query: { id }, headers: {}, body: undefined },
    res,
  );
  assert(res.statusCode === 200, `expected 200 for delete, got ${res.statusCode}`);
  assert(res.body.data.deleted === true, 'expected deleted:true');
}

// 8. GET deleted → 404
console.log('8. GET /api/nurseries/:id (deleted, expect 404)');
res = mockRes();
await byIdHandler(
  { method: 'GET', query: { id: createdId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`);

// 9. method not allowed
console.log('9. PUT /api/nurseries (expect 405)');
res = mockRes();
await listCreateHandler({ method: 'PUT', query: {}, headers: {}, body: {} }, res);
assert(res.statusCode === 405, `expected 405, got ${res.statusCode}`);

console.log('\nAll 9 checks passed ✅');
