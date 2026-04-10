// B2.4 smoke test: GET /api/auth/me
//
// Invokes the handler directly (no HTTP server) with mocked req/res. Covers:
// - valid cookie → 200 with full user + role payload (shape matches /login)
// - no cookie → 401 unauthenticated
// - garbage cookie → 401 unauthenticated
// - expired session → 401 (lazy GC kicks in, row removed)
// - revoked session → 401
// - inactive user → 401
// - soft-deleted user → 401
// - wrong method → 405
// - /me does NOT write an audit row (read-only, noisy otherwise)

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { hashPassword } = await import('../src/lib/password.ts');
const { createSession } = await import('../src/lib/auth.ts');
const { SESSION_COOKIE_NAME } = await import('../src/lib/cookies.ts');
const meHandler = (await import('../api/auth/me.ts')).default;

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed += 1;
  console.log('  ✓', msg);
}

function mockReq({ cookie, headers = {}, method = 'GET' } = {}) {
  return {
    method,
    query: {},
    body: {},
    headers: {
      'user-agent': 'me-smoke-test/1.0',
      'x-forwarded-for': '203.0.113.77',
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this.headers[k];
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invoke(req) {
  const res = mockRes();
  await meHandler(req, res);
  return res;
}

function cookieHeaderFor(token) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------
const suffix = Date.now();
const role = await prisma.role.create({
  data: {
    name: `me-test-${suffix}`,
    label: { en: 'Me Test Role', ar: 'دور اختبار أنا' },
    permissions: { canReadEverything: true },
    isSystem: false,
  },
});

const email = `me-smoke+${suffix}@yalladj.test`;
const user = await prisma.user.create({
  data: {
    email,
    passwordHash: await hashPassword('correct-horse-battery-staple'),
    name: 'Me Smoke User',
    phone: '+971500000000',
    avatarUrl: 'https://example.com/avatar.png',
    roleId: role.id,
  },
});

async function countAudit() {
  return prisma.auditLog.count({
    where: { entityLabel: email },
  });
}

// ------------------------------------------------------------------
// 1. Valid session → 200 + full payload + NO audit row
// ------------------------------------------------------------------
console.log('1. valid session');
{
  const auditBefore = await countAudit();
  const { token } = await createSession(user.id);

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 200, `200 OK (got ${res.statusCode})`);
  assert(res.body?.ok === true, 'response.ok=true');

  const u = res.body?.data?.user;
  assert(u?.id === user.id, 'data.user.id matches');
  assert(u?.email === email, 'data.user.email matches');
  assert(u?.name === 'Me Smoke User', 'data.user.name matches');
  assert(u?.phone === '+971500000000', 'data.user.phone matches');
  assert(u?.avatarUrl === 'https://example.com/avatar.png', 'data.user.avatarUrl matches');
  assert(u?.roleId === role.id, 'data.user.roleId matches');
  assert('lastLoginAt' in u, 'data.user.lastLoginAt present');
  assert(!('passwordHash' in u), 'passwordHash NOT leaked');

  const r = res.body?.data?.role;
  assert(r?.id === role.id, 'data.role.id matches');
  assert(r?.name === `me-test-${suffix}`, 'data.role.name matches');
  assert(r?.label?.en === 'Me Test Role', 'data.role.label.en matches');
  assert(r?.permissions?.canReadEverything === true, 'data.role.permissions matches');

  const auditAfter = await countAudit();
  assert(auditAfter === auditBefore, '/me writes NO audit row (read-only)');

  await prisma.session.delete({ where: { token } });
}

// ------------------------------------------------------------------
// 2. No cookie → 401 unauthenticated
// ------------------------------------------------------------------
console.log('2. no cookie');
{
  const res = await invoke(mockReq());
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.ok === false, 'response.ok=false');
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');
}

// ------------------------------------------------------------------
// 3. Garbage cookie → 401
// ------------------------------------------------------------------
console.log('3. garbage cookie');
{
  const res = await invoke(
    mockReq({ cookie: cookieHeaderFor('deadbeef'.repeat(8)) }),
  );
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');
}

// ------------------------------------------------------------------
// 4. Revoked session → 401 (and DB row is gone)
// ------------------------------------------------------------------
console.log('4. revoked session');
{
  const { token } = await createSession(user.id);
  await prisma.session.delete({ where: { token } });

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');
}

// ------------------------------------------------------------------
// 5. Expired session → 401 + lazy GC deletes the row
// ------------------------------------------------------------------
console.log('5. expired session');
{
  const { token } = await createSession(user.id);
  // Backdate expiry so getSessionByToken treats it as expired.
  await prisma.session.update({
    where: { token },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');

  const row = await prisma.session.findUnique({ where: { token } });
  assert(row === null, 'expired session lazy-GC deleted');
}

// ------------------------------------------------------------------
// 6. Inactive user → 401
// ------------------------------------------------------------------
console.log('6. inactive user');
{
  const { token } = await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');

  await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
  await prisma.session.delete({ where: { token } }).catch(() => {});
}

// ------------------------------------------------------------------
// 7. Soft-deleted user → 401
// ------------------------------------------------------------------
console.log('7. soft-deleted user');
{
  const { token } = await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'unauthenticated', 'error=unauthenticated');

  await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } });
  await prisma.session.delete({ where: { token } }).catch(() => {});
}

// ------------------------------------------------------------------
// 8. Wrong method → 405
// ------------------------------------------------------------------
console.log('8. method routing');
{
  const res = await invoke(mockReq({ method: 'POST' }));
  assert(res.statusCode === 405, `405 on POST (got ${res.statusCode})`);
  assert(res.body?.ok === false, 'response.ok=false on 405');
}

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
console.log('cleanup');
await prisma.$executeRaw`DELETE FROM audit_logs WHERE entity_label = ${email}`;
await prisma.$executeRaw`DELETE FROM sessions WHERE user_id = ${user.id}`;
await prisma.user.delete({ where: { id: user.id } });
await prisma.role.delete({ where: { id: role.id } });

console.log(`\nAll ${passed} /me checks passed ✅`);
