// B2.3 smoke test: POST /api/auth/logout
//
// Invokes the handler directly (no HTTP server) with mocked req/res. Creates
// a throwaway user + session, exercises the happy + idempotent paths, confirms
// the DB session row is deleted, cookie clear header lands, and audit rows
// land only on real logouts (not anonymous no-ops).

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { hashPassword } = await import('../src/lib/password.ts');
const { createSession, getSessionByToken } = await import('../src/lib/auth.ts');
const { SESSION_COOKIE_NAME } = await import('../src/lib/cookies.ts');
const logoutHandler = (await import('../api/auth/logout.ts')).default;

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed += 1;
  console.log('  ✓', msg);
}

function mockReq({ cookie, headers = {}, method = 'POST' } = {}) {
  return {
    method,
    query: {},
    body: {},
    headers: {
      'user-agent': 'logout-smoke-test/1.0',
      'x-forwarded-for': '203.0.113.99',
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
  await logoutHandler(req, res);
  return res;
}

function cookieHeaderFor(token) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function setCookieString(res) {
  const v = res.getHeader('Set-Cookie');
  if (!v) return null;
  return Array.isArray(v) ? v.join('\n') : String(v);
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------
const suffix = Date.now();
const role = await prisma.role.create({
  data: {
    name: `logout-test-${suffix}`,
    label: { en: 'Logout Test Role', ar: 'دور اختبار تسجيل الخروج' },
    permissions: {},
    isSystem: false,
  },
});

const email = `logout-smoke+${suffix}@yalladj.test`;
const user = await prisma.user.create({
  data: {
    email,
    passwordHash: await hashPassword('correct-horse-battery-staple'),
    name: 'Logout Smoke User',
    roleId: role.id,
  },
});

async function countAudit(action) {
  return prisma.auditLog.count({
    where: { action, entityLabel: email },
  });
}

// ------------------------------------------------------------------
// 1. Valid logout with real session → 200 + cookie cleared + DB row gone + audit
// ------------------------------------------------------------------
console.log('1. valid logout');
{
  const { token } = await createSession(user.id);
  const before = await prisma.session.findUnique({ where: { token } });
  assert(before !== null, 'session row exists before logout');

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(token) }));
  assert(res.statusCode === 200, `200 OK (got ${res.statusCode})`);
  assert(res.body?.ok === true, 'response.ok=true');
  assert(res.body?.data?.loggedOut === true, 'data.loggedOut=true');

  const sc = setCookieString(res);
  assert(sc !== null, 'Set-Cookie header set');
  assert(sc.includes(`${SESSION_COOKIE_NAME}=`), 'cookie has session name');
  assert(sc.includes('Max-Age=0'), 'cookie Max-Age=0 (cleared)');
  assert(sc.includes('HttpOnly'), 'cookie HttpOnly');
  assert(sc.includes('SameSite=Lax'), 'cookie SameSite=Lax');

  const after = await prisma.session.findUnique({ where: { token } });
  assert(after === null, 'session row deleted from DB');

  // Double-check via the public lookup used by attachSessionUser
  const lookup = await getSessionByToken(token);
  assert(lookup === null, 'getSessionByToken returns null after logout');

  const successCount = await countAudit('auth.logout.success');
  assert(successCount === 1, `1 audit row for auth.logout.success (got ${successCount})`);

  const row = await prisma.auditLog.findFirst({
    where: { action: 'auth.logout.success', entityLabel: email },
    orderBy: { createdAt: 'desc' },
  });
  assert(row?.actorType === 'user', 'actorType=user on logout audit');
  assert(row?.actorId === user.id, 'actorId matches logged-out user');
  assert(row?.ipAddress === '203.0.113.99', 'audit captures IP');
}

// ------------------------------------------------------------------
// 2. Logout with no cookie → 200 idempotent, no audit, cookie clear header set
// ------------------------------------------------------------------
console.log('2. logout with no cookie');
{
  const before = await countAudit('auth.logout.success');
  const res = await invoke(mockReq()); // no cookie
  assert(res.statusCode === 200, `200 OK (got ${res.statusCode})`);
  assert(res.body?.data?.loggedOut === true, 'data.loggedOut=true');
  const sc = setCookieString(res);
  assert(sc !== null && sc.includes('Max-Age=0'), 'Set-Cookie clears cookie even on no-op');
  const after = await countAudit('auth.logout.success');
  assert(after === before, 'no new audit row for anonymous logout');
}

// ------------------------------------------------------------------
// 3. Logout with unknown/garbage token → 200, no crash, no audit
// ------------------------------------------------------------------
console.log('3. logout with unknown token');
{
  const before = await countAudit('auth.logout.success');
  const res = await invoke(
    mockReq({ cookie: cookieHeaderFor('deadbeef'.repeat(8)) }),
  );
  assert(res.statusCode === 200, `200 OK (got ${res.statusCode})`);
  assert(res.body?.data?.loggedOut === true, 'data.loggedOut=true');
  const sc = setCookieString(res);
  assert(sc !== null && sc.includes('Max-Age=0'), 'Set-Cookie clears cookie');
  const after = await countAudit('auth.logout.success');
  assert(after === before, 'no new audit row for unknown token');
}

// ------------------------------------------------------------------
// 4. Logout twice with the same (now-revoked) cookie → second call is a no-op
// ------------------------------------------------------------------
console.log('4. double logout (already revoked)');
{
  const { token } = await createSession(user.id);
  const cookie = cookieHeaderFor(token);

  const first = await invoke(mockReq({ cookie }));
  assert(first.statusCode === 200, 'first logout 200');

  const before = await countAudit('auth.logout.success');
  const second = await invoke(mockReq({ cookie }));
  assert(second.statusCode === 200, 'second logout also 200');
  const sc = setCookieString(second);
  assert(sc !== null && sc.includes('Max-Age=0'), 'second logout still clears cookie');
  const after = await countAudit('auth.logout.success');
  assert(
    after === before,
    'second logout writes NO new audit row (session already gone)',
  );
}

// ------------------------------------------------------------------
// 5. Wrong method → 405
// ------------------------------------------------------------------
console.log('5. method routing');
{
  const res = await invoke(mockReq({ method: 'GET' }));
  assert(res.statusCode === 405, `405 on GET (got ${res.statusCode})`);
  assert(res.body?.ok === false, 'response.ok=false on 405');
}

// ------------------------------------------------------------------
// 6. Logout does not revoke OTHER sessions belonging to the same user
// ------------------------------------------------------------------
console.log('6. logout scoped to current session only');
{
  const a = await createSession(user.id);
  const b = await createSession(user.id);

  const res = await invoke(mockReq({ cookie: cookieHeaderFor(a.token) }));
  assert(res.statusCode === 200, '200 on scoped logout');

  const gone = await prisma.session.findUnique({ where: { token: a.token } });
  assert(gone === null, 'logged-out session deleted');
  const kept = await prisma.session.findUnique({ where: { token: b.token } });
  assert(kept !== null, 'OTHER session for same user untouched');

  // cleanup the sibling session
  await prisma.session.delete({ where: { token: b.token } });
}

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
console.log('cleanup');
await prisma.$executeRaw`DELETE FROM audit_logs WHERE entity_label = ${email}`;
await prisma.$executeRaw`DELETE FROM sessions WHERE user_id = ${user.id}`;
await prisma.user.delete({ where: { id: user.id } });
await prisma.role.delete({ where: { id: role.id } });

console.log(`\nAll ${passed} logout checks passed ✅`);
