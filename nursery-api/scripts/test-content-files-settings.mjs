// A3.7 smoke test: deliverables, content_blocks, site_templates, files, settings.
// Creates a parent nursery + project, then exercises:
//   Deliverables (6 checks)
//     1. POST   /api/deliverables
//     2. GET    /api/deliverables?projectId=...
//     3. PATCH  /api/deliverables/:id isApproved=true → approvedAt stamped
//     4. POST   /api/deliverables bad projectId → 400
//     5. GET    /api/deliverables/:id
//     6. DELETE /api/deliverables/:id → 200
//   Content blocks (6 checks)
//     7.  POST   /api/content-blocks (global)
//     8.  POST   /api/content-blocks duplicate key → 409
//     9.  POST   /api/content-blocks bad nursery → 400
//     10. GET    /api/content-blocks?category=...
//     11. PATCH  /api/content-blocks/:id
//     12. DELETE /api/content-blocks/:id → 200
//   Site templates (5 checks)
//     13. POST   /api/site-templates isDefault=true
//     14. POST   /api/site-templates second one with isDefault=true
//         → first one gets isDefault=false (verified via GET)
//     15. PATCH  /api/site-templates/:id name
//     16. POST   /api/site-templates duplicate key → 409
//     17. DELETE both templates
//   Files (6 checks)
//     18. POST   /api/files linked to nursery
//     19. POST   /api/files linked to bad nursery → 400
//     20. GET    /api/files?linkedTable=nurseries&linkedId=...
//         (sizeBytes serialized as string)
//     21. POST   /api/files duplicate storageKey → 409
//     22. PATCH  /api/files/:id label
//     23. DELETE /api/files/:id → 200
//   Settings (6 checks)
//     24. POST   /api/settings
//     25. POST   /api/settings duplicate key → 409
//     26. GET    /api/settings?key=...
//     27. PATCH  /api/settings/:id value
//     28. DELETE isSystem=true → 400, non-system → 200
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
const { default: deliverableListCreate } = await import('../api/deliverables/index.ts');
const { default: deliverableById } = await import('../api/deliverables/[id].ts');
const { default: blockListCreate } = await import('../api/content-blocks/index.ts');
const { default: blockById } = await import('../api/content-blocks/[id].ts');
const { default: tplListCreate } = await import('../api/site-templates/index.ts');
const { default: tplById } = await import('../api/site-templates/[id].ts');
const { default: fileListCreate } = await import('../api/files/index.ts');
const { default: fileById } = await import('../api/files/[id].ts');
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

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const stamp = Date.now();

// Setup
console.log('setup: create nursery + project');
let res = mockRes();
await nurseryListCreate(
  { method: 'POST', query: {}, headers: {}, body: { name: 'A3.7 Nursery', slug: `smoke-a37-${stamp}` } },
  res,
);
assert(res.statusCode === 201, `nursery create: ${JSON.stringify(res.body)}`);
const nurseryId = res.body.data.id;

res = mockRes();
await projectListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      nurseryId,
      name: 'A3.7 Project',
      slug: `smoke-a37-project-${stamp}`,
      packageType: 'standard',
    },
  },
  res,
);
assert(res.statusCode === 201, `project create: ${JSON.stringify(res.body)}`);
const projectId = res.body.data.id;

// =========================================================================
// DELIVERABLES
// =========================================================================

// 1. POST
console.log('1. POST /api/deliverables');
res = mockRes();
await deliverableListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      projectId,
      title: 'Home page mockup v1',
      titleAr: 'تصميم الصفحة الرئيسية',
      description: 'Figma link + PNG exports',
      type: 'mockup',
      fileUrl: 'https://example.com/mockup.fig',
      previewUrl: 'https://example.com/mockup.png',
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.version === 1, 'default version should be 1');
assert(res.body.data.isApproved === false, 'default isApproved should be false');
const deliverableId = res.body.data.id;

// 2. LIST
console.log('2. GET /api/deliverables?projectId=...');
res = mockRes();
await deliverableListCreate(
  { method: 'GET', query: { projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 deliverable');

// 3. PATCH isApproved=true
console.log('3. PATCH /api/deliverables/:id isApproved=true');
res = mockRes();
await deliverableById(
  {
    method: 'PATCH',
    query: { id: deliverableId },
    headers: {},
    body: { isApproved: true, approvedById: 'user_abc' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.isApproved === true, 'isApproved not set');
assert(res.body.data.approvedAt !== null, 'approvedAt should auto-stamp');

// 4. POST bad projectId
console.log('4. POST /api/deliverables bad projectId → 400');
res = mockRes();
await deliverableListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      projectId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
      title: 'x',
      type: 'asset',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_project', 'expected invalid_project');

// 5. GET by id
console.log('5. GET /api/deliverables/:id');
res = mockRes();
await deliverableById(
  { method: 'GET', query: { id: deliverableId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// 6. DELETE
console.log('6. DELETE /api/deliverables/:id → 200');
res = mockRes();
await deliverableById(
  { method: 'DELETE', query: { id: deliverableId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// =========================================================================
// CONTENT BLOCKS
// =========================================================================

const blockKey = `smoke_hero_${stamp}`;

// 7. POST global block
console.log('7. POST /api/content-blocks (global)');
res = mockRes();
await blockListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: blockKey,
      category: 'hero',
      titleEn: 'Welcome to our nursery',
      titleAr: 'مرحبا بكم في حضانتنا',
      bodyEn: 'A safe and joyful place for your child.',
      bodyAr: 'مكان آمن وممتع لطفلك.',
      tags: ['hero', 'homepage'],
      isGlobal: true,
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.isGlobal === true, 'isGlobal not set');
const blockId = res.body.data.id;

// 8. POST duplicate key
console.log('8. POST /api/content-blocks duplicate key → 409');
res = mockRes();
await blockListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { key: blockKey, category: 'hero' },
  },
  res,
);
assert(res.statusCode === 409, `expected 409, got ${res.statusCode}`);
assert(res.body.error === 'duplicate_key', `expected duplicate_key, got ${res.body.error}`);

// 9. POST bad nursery
console.log('9. POST /api/content-blocks bad nursery → 400');
res = mockRes();
await blockListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: `smoke_block_bad_${stamp}`,
      category: 'about',
      nurseryId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_nursery', 'expected invalid_nursery');

// 10. LIST by category
console.log('10. GET /api/content-blocks?category=hero');
res = mockRes();
await blockListCreate(
  { method: 'GET', query: { category: 'hero' }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 block');

// 11. PATCH
console.log('11. PATCH /api/content-blocks/:id');
res = mockRes();
await blockById(
  {
    method: 'PATCH',
    query: { id: blockId },
    headers: {},
    body: { titleEn: 'Welcome (updated)', sortOrder: 10 },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.titleEn === 'Welcome (updated)', 'title not updated');
assert(res.body.data.sortOrder === 10, 'sortOrder not updated');

// 12. DELETE
console.log('12. DELETE /api/content-blocks/:id → 200');
res = mockRes();
await blockById(
  { method: 'DELETE', query: { id: blockId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// =========================================================================
// SITE TEMPLATES
// =========================================================================

const tplKeyA = `smoke_tpl_a_${stamp}`;
const tplKeyB = `smoke_tpl_b_${stamp}`;

// 13. POST first default
console.log('13. POST /api/site-templates A (isDefault=true)');
res = mockRes();
await tplListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: tplKeyA,
      name: 'Starter A',
      packageType: 'starter',
      pages: [{ slug: 'home', title_en: 'Home', sections: [] }],
      isDefault: true,
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.isDefault === true, 'A should be default');
const tplAId = res.body.data.id;

// 14. POST second default — should unset A
console.log('14. POST /api/site-templates B (isDefault=true) → A unset');
res = mockRes();
await tplListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: tplKeyB,
      name: 'Starter B',
      packageType: 'starter',
      pages: [{ slug: 'home', title_en: 'Home', sections: [] }],
      isDefault: true,
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}`);
const tplBId = res.body.data.id;

res = mockRes();
await tplById(
  { method: 'GET', query: { id: tplAId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'fetch A after B');
assert(res.body.data.isDefault === false, 'A should have been unset as default');

// 15. PATCH name
console.log('15. PATCH /api/site-templates/:id name');
res = mockRes();
await tplById(
  {
    method: 'PATCH',
    query: { id: tplBId },
    headers: {},
    body: { name: 'Starter B (renamed)' },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.name === 'Starter B (renamed)', 'name not updated');

// 16. POST duplicate key
console.log('16. POST /api/site-templates duplicate key → 409');
res = mockRes();
await tplListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: tplKeyA,
      name: 'dup',
      packageType: 'starter',
      pages: [{ slug: 'home' }],
    },
  },
  res,
);
assert(res.statusCode === 409, `expected 409, got ${res.statusCode}`);
assert(res.body.error === 'duplicate_key', 'expected duplicate_key');

// 17. DELETE both
console.log('17. DELETE both site templates');
for (const tid of [tplAId, tplBId]) {
  res = mockRes();
  await tplById(
    { method: 'DELETE', query: { id: tid }, headers: {}, body: undefined },
    res,
  );
  assert(res.statusCode === 200, `delete ${tid}: ${res.statusCode}`);
}

// =========================================================================
// FILES
// =========================================================================

const storageKey = `uploads/smoke/${stamp}/logo.png`;

// 18. POST file linked to nursery
console.log('18. POST /api/files linked to nursery');
res = mockRes();
await fileListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      filename: 'logo.png',
      storageKey,
      url: 'https://cdn.example.com/' + storageKey,
      mimeType: 'image/png',
      sizeBytes: 204800,
      linkedTable: 'nurseries',
      linkedId: nurseryId,
      label: 'logo',
      isPublic: true,
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(typeof res.body.data.sizeBytes === 'string', 'sizeBytes should be string');
assert(res.body.data.sizeBytes === '204800', 'sizeBytes roundtrip');
const fileId = res.body.data.id;

// 19. POST bad linked nursery
console.log('19. POST /api/files bad linked nursery → 400');
res = mockRes();
await fileListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      filename: 'x.png',
      storageKey: `uploads/smoke/${stamp}/bad.png`,
      url: 'https://cdn.example.com/bad.png',
      mimeType: 'image/png',
      sizeBytes: 1,
      linkedTable: 'nurseries',
      linkedId: 'ckxxxxxxxxxxxxxxxxxxxxxxxx',
    },
  },
  res,
);
assert(res.statusCode === 400, `expected 400, got ${res.statusCode}`);
assert(res.body.error === 'invalid_linked_parent', `got ${res.body.error}`);

// 20. LIST
console.log('20. GET /api/files?linkedTable=nurseries&linkedId=...');
res = mockRes();
await fileListCreate(
  {
    method: 'GET',
    query: { linkedTable: 'nurseries', linkedId: nurseryId },
    headers: {},
    body: undefined,
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total >= 1, 'expected at least 1 file');
assert(
  res.body.data.rows.every((r) => r.sizeBytes === null || typeof r.sizeBytes === 'string'),
  'sizeBytes should be string|null',
);

// 21. POST duplicate storageKey
console.log('21. POST /api/files duplicate storageKey → 409');
res = mockRes();
await fileListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      filename: 'logo2.png',
      storageKey, // same as before
      url: 'https://cdn.example.com/other.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      linkedTable: 'nurseries',
      linkedId: nurseryId,
    },
  },
  res,
);
assert(res.statusCode === 409, `expected 409, got ${res.statusCode}`);
assert(res.body.error === 'duplicate_storage_key', `got ${res.body.error}`);

// 22. PATCH label
console.log('22. PATCH /api/files/:id label');
res = mockRes();
await fileById(
  {
    method: 'PATCH',
    query: { id: fileId },
    headers: {},
    body: { label: 'primary_logo', isPublic: false },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.label === 'primary_logo', 'label not updated');
assert(res.body.data.isPublic === false, 'isPublic not updated');

// 23. DELETE
console.log('23. DELETE /api/files/:id → 200');
res = mockRes();
await fileById(
  { method: 'DELETE', query: { id: fileId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// =========================================================================
// SETTINGS
// =========================================================================

const settingKey = `smoke.site.title.${stamp}`;
const sysKey = `smoke.sys.flag.${stamp}`;

// 24. POST setting
console.log('24. POST /api/settings');
res = mockRes();
await settingListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: settingKey,
      value: { en: 'Yalla DJ', ar: 'يالا دي جي' },
      category: 'general',
      label: 'Site title',
      isPublic: true,
    },
  },
  res,
);
assert(res.statusCode === 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.value.en === 'Yalla DJ', 'value.en not stored');
const settingId = res.body.data.id;

// Also seed a system setting we will try (and fail) to delete.
res = mockRes();
await settingListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: {
      key: sysKey,
      value: true,
      category: 'system',
      isSystem: true,
    },
  },
  res,
);
assert(res.statusCode === 201, 'system setting create');
const sysId = res.body.data.id;

// 25. POST duplicate key
console.log('25. POST /api/settings duplicate key → 409');
res = mockRes();
await settingListCreate(
  {
    method: 'POST',
    query: {},
    headers: {},
    body: { key: settingKey, value: 'dup' },
  },
  res,
);
assert(res.statusCode === 409, `expected 409, got ${res.statusCode}`);
assert(res.body.error === 'duplicate_key', 'expected duplicate_key');

// 26. LIST by key
console.log('26. GET /api/settings?key=...');
res = mockRes();
await settingListCreate(
  { method: 'GET', query: { key: settingKey }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);
assert(res.body.data.total === 1, `expected total=1, got ${res.body.data.total}`);
assert(res.body.data.rows[0].key === settingKey, 'wrong row returned');

// 27. PATCH value
console.log('27. PATCH /api/settings/:id value');
res = mockRes();
await settingById(
  {
    method: 'PATCH',
    query: { id: settingId },
    headers: {},
    body: { value: { en: 'Yalla DJ Media', ar: 'يالا دي جي ميديا' } },
  },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
assert(res.body.data.value.en === 'Yalla DJ Media', 'value not updated');

// 28. DELETE isSystem=true → 400; non-system → 200
console.log('28. DELETE system setting → 400, normal → 200');
res = mockRes();
await settingById(
  { method: 'DELETE', query: { id: sysId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 400, `expected 400 on system delete, got ${res.statusCode}`);
assert(res.body.error === 'system_setting', `got ${res.body.error}`);

res = mockRes();
await settingById(
  { method: 'DELETE', query: { id: settingId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`);

// Soft-clean the system setting via direct prisma (since API refuses) so the
// DB doesn't accumulate smoke rows.
const { prisma } = await import('../src/lib/prisma.ts');
await prisma.setting.update({ where: { id: sysId }, data: { deletedAt: new Date() } });

// =========================================================================
// CLEANUP
// =========================================================================

console.log('cleanup: delete project + nursery');
res = mockRes();
await projectById(
  { method: 'DELETE', query: { id: projectId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup project delete failed');

res = mockRes();
await nurseryById(
  { method: 'DELETE', query: { id: nurseryId }, headers: {}, body: undefined },
  res,
);
assert(res.statusCode === 200, 'cleanup nursery delete failed');

console.log('\nAll 28 checks passed ✅');
