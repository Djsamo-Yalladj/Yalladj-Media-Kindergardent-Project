// End-to-end smoke test for tickets, service_contracts, and handovers routes.
// Creates a parent nursery + project, then exercises:
//   Tickets:
//     1. POST   /api/tickets
//     2. GET    /api/tickets?nurseryId=...
//     3. GET    /api/tickets/:id
//     4. PATCH  /api/tickets/:id status=resolved → resolvedAt stamped
//     5. PATCH  /api/tickets/:id status=closed   → closedAt stamped
//     6. POST   /api/tickets bad nurseryId → 400
//     7. POST   /api/tickets project belongs to other nursery → 400
//     8. DELETE /api/tickets/:id → 200, GET → 404
//   Service contracts:
//     9.  POST   /api/service-contracts
//     10. GET    /api/service-contracts?nurseryId=...
//     11. PATCH  /api/service-contracts/:id status=cancelled → cancelledAt stamped
//     12. POST   /api/service-contracts bad contract_type → 400
//     13. DELETE /api/service-contracts/:id → 200
//   Handovers:
//     14. POST   /api/handovers
//     15. GET    /api/handovers?nurseryId=...  (sizeBytes serialized as string)
//     16. PATCH  /api/handovers/:id acknowledgedAt
//     17. DELETE /api/handovers/:id → 200
// Cleans up project + nursery at end.

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
const { default: ticketListCreate } = await import('../api/tickets/index.ts');
const { default: ticketById } = await import('../api/tickets/[id].ts');
const { default: contractListCreate } = await import('../api/service-contracts/index.ts');
const { default: contractById } = await import('../api/service-contracts/[id].ts');
const { default: handoverListCreate } = await import('../api/handovers/index.ts');
const { default: handoverById } = await import('../api/handovers/[id].ts');
const { prisma } = await import('../src/lib/prisma.ts');

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

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const stamp = Date.now();

// Setup: look up a real contract_type (seeded)
console.log('setup: fetch a contract_type');
const contractType = await prisma.contractTypeDef.findFirst({
  where: { key: 'monthly_support', deletedAt: null },
  select: { id: true },
});
assert(contractType, 'seed contract_type "monthly_support" not found — run seed-contract-types.mjs first');
const contractTypeId = contractType.id;

// Setup: two nurseries so we can test cross-nursery project mismatch
console.log('setup: create two nurseries');
let res = mockRes();
await nurseryListCreate(
  { method: 'POST', query: {}, headers: {}, body: { name: 'A3.6 Nursery A', slug: `smoke-a36a-${stamp}` } },
  res,
);
assert(res.statusCode === 201, `nursery A create: ${JSON.stringify(res.body)}`);
const nurseryAId = res.body.data.id;

res = mockRes();
await nurseryListCreate(
  { method: 'POST', query: {}, headers: {}, body: { name: 'A3.6 Nursery B', slug: `smoke-a36b-${stamp}` } },
  res,
);
assert(res.statusCode === 201, `nursery B create: ${JSON.stringify(res.body)}`);
const nurseryBId = res.body.data.id;

console.log('setup: create project under nursery A');
res = mockRes();
await projectListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryAId,
      name: 'A3.6 Project',
      slug: `smoke-a36-project-${stamp}`,
      packageType: 'standard',
    },
  },
  res,
);
assert(res.statusCode === 201, `project create: ${JSON.stringify(res.body)}`);
const projectId = res.body.data.id;

// =========================================================================
// TICKETS
// =========================================================================

// 1. POST /api/tickets
console.log('1. POST /api/tickets');
res = mockRes();
await ticketListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryAId,
      projectId,
      title: 'Logo is blurry on mobile',
      description: 'The hero logo looks fuzzy on iPhone portrait',
      type: 'bug',
      priority: 'high',
      reportedEmail: 'client@example.com',
      tags: ['mobile', 'hero'],
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.status === 'open', 'default status should be open');
assert(res.body.data.priority === 'high', 'priority not set');
const ticketId = res.body.data.id;
console.log('   ticket id:', ticketId);

// 2. LIST
console.log('2. GET /api/tickets?nurseryId=...');
res = mockRes();
await ticketListCreate(
  { method: 'GET', query: { nurseryId: nurseryAId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 ticket');

// 3. GET by id
console.log('3. GET /api/tickets/:id');
res = mockRes();
await ticketById(
  { method: 'GET', query: { id: ticketId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// 4. PATCH status=resolved
console.log('4. PATCH /api/tickets/:id status=resolved');
res = mockRes();
await ticketById(
  {
    method: 'PATCH',
    query: { id: ticketId },
    headers: {},
    body: { status: 'resolved', resolutionNote: 'swapped to 2x asset' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.status === 'resolved', 'status not updated');
assert(res.body.data.resolvedAt !== null, 'resolvedAt should auto-stamp');

// 5. PATCH status=closed
console.log('5. PATCH /api/tickets/:id status=closed');
res = mockRes();
await ticketById(
  { method: 'PATCH', query: { id: ticketId }, headers: {}, body: { status: 'closed' } },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.closedAt !== null, 'closedAt should auto-stamp');

// 6. POST with bad nurseryId
console.log('6. POST /api/tickets bad nurseryId → 400');
res = mockRes();
await ticketListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
      title: 'x',
      description: 'y',
      type: 'bug',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_nursery', 'expected invalid_nursery');

// 7. POST project under different nursery
console.log('7. POST /api/tickets project/nursery mismatch → 400');
res = mockRes();
await ticketListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryBId,
      projectId,
      title: 'x',
      description: 'y',
      type: 'support',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'project_nursery_mismatch', `expected project_nursery_mismatch, got ${res.body.error}`);

// 8. DELETE ticket
console.log('8. DELETE /api/tickets/:id → 200, GET → 404');
res = mockRes();
await ticketById(
  { method: 'DELETE', query: { id: ticketId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
res = mockRes();
await ticketById(
  { method: 'GET', query: { id: ticketId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`);

// =========================================================================
// SERVICE CONTRACTS
// =========================================================================

// 9. POST
console.log('9. POST /api/service-contracts');
res = mockRes();
await contractListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryAId,
      projectId,
      contractTypeId,
      title: 'A3.6 Monthly Support',
      amount: 500,
      billingCycle: 'monthly',
      startDate: new Date().toISOString(),
      autoRenew: true,
      terms: { sla: '48h response' },
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.status === 'active', 'default status should be active');
const contractId = res.body.data.id;

// 10. LIST
console.log('10. GET /api/service-contracts?nurseryId=...');
res = mockRes();
await contractListCreate(
  { method: 'GET', query: { nurseryId: nurseryAId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 contract');

// 11. PATCH status=cancelled
console.log('11. PATCH /api/service-contracts/:id status=cancelled');
res = mockRes();
await contractById(
  {
    method: 'PATCH',
    query: { id: contractId },
    headers: {},
    body: { status: 'cancelled', cancelReason: 'client churned' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.cancelledAt !== null, 'cancelledAt should auto-stamp');

// 12. POST bad contract_type
console.log('12. POST /api/service-contracts bad contract_type → 400');
res = mockRes();
await contractListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryAId,
      contractTypeId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
      title: 'x',
      amount: 100,
      startDate: new Date().toISOString(),
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_contract_type', `expected invalid_contract_type, got ${res.body.error}`);

// 13. DELETE contract
console.log('13. DELETE /api/service-contracts/:id → 200');
res = mockRes();
await contractById(
  { method: 'DELETE', query: { id: contractId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// =========================================================================
// HANDOVERS
// =========================================================================

// 14. POST
console.log('14. POST /api/handovers');
res = mockRes();
await handoverListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId: nurseryAId,
      projectId,
      type: 'code_handover',
      title: 'Final source bundle',
      description: 'Full repo archive + manifest',
      archiveUrl: 'https://example.com/bundle.zip',
      manifest: { files: 123, version: '1.0.0' },
      sizeBytes: 104857600, // 100 MB
      deliveredAt: new Date().toISOString(),
      deliveredToEmail: 'client@example.com',
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(typeof res.body.data.sizeBytes === 'string', 'sizeBytes should be serialized as string');
assert(res.body.data.sizeBytes === '104857600', `sizeBytes roundtrip, got ${res.body.data.sizeBytes}`);
const handoverId = res.body.data.id;

// 15. LIST
console.log('15. GET /api/handovers?nurseryId=...');
res = mockRes();
await handoverListCreate(
  { method: 'GET', query: { nurseryId: nurseryAId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 handover');
assert(
  res.body.data.rows.every((r) => r.sizeBytes === null || typeof r.sizeBytes === 'string'),
  'list sizeBytes should be string|null',
);

// 16. PATCH acknowledge
console.log('16. PATCH /api/handovers/:id acknowledgedAt');
res = mockRes();
await handoverById(
  {
    method: 'PATCH',
    query: { id: handoverId },
    headers: {},
    body: { acknowledgedAt: new Date().toISOString() },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.acknowledgedAt !== null, 'acknowledgedAt should be set');

// 17. DELETE handover
console.log('17. DELETE /api/handovers/:id → 200');
res = mockRes();
await handoverById(
  { method: 'DELETE', query: { id: handoverId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// =========================================================================
// CLEANUP
// =========================================================================

console.log('cleanup: delete project + nurseries');
res = mockRes();
await projectById(
  { method: 'DELETE', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup project delete failed');

res = mockRes();
await nurseryById(
  { method: 'DELETE', query: { id: nurseryAId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup nursery A delete failed');

res = mockRes();
await nurseryById(
  { method: 'DELETE', query: { id: nurseryBId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup nursery B delete failed');

console.log('\nAll 17 checks passed ✅');
