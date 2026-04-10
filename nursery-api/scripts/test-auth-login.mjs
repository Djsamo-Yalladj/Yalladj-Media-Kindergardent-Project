// B2.2 smoke test: POST /api/auth/login
//
// Invokes the handler directly (no HTTP server) with mocked req/res. Creates
// a throwaway role + user, exercises valid + invalid paths, confirms session
// cookie is set, and checks audit_logs rows land for both success and failure.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { hashPassword } = await import('../src/lib/password.ts');
const { SESSION_COOKIE_NAME } = await import('../src/lib/cookies.ts');
const loginHandler = (await import('../api/auth/login.ts')).default;

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed += 1;
  console.log('  ✓', msg);
}

function mockReq({ body = {}, headers = {} } = {}) {
  return {
    method: 'POST',
    query: {},
    body,
    headers: {
      'user-agent': 'login-smoke-test/1.0',
      'x-forwarded-for': '203.0.113.42',
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
  await loginHandler(req, res);
  return res;
}

// ------------------------------------------------------------------
// Setup
// ------------------------------------------------------------------
const suffix = Date.now();
const role = await prisma.role.create({
  data: {
    name: `login-test-${suffix}`,
    label: { en: 'Login Test Role', ar: 'دور اختبار تسجيل الدخول' },
    permissions: {},
    isSystem: false,
  },
});

const email = `login-smoke+${suffix}@yalladj.test`;
const password = 'correct-horse-battery-staple';
const user = await prisma.user.create({
  data: {
    email,
    passwordHash: await hashPassword(password),
    name: 'Login Smoke User',
    roleId: role.id,
  },
});

// Audit log baseline count for this entity
async function countAudit(action) {
  return prisma.auditLog.count({
    where: { action, entityLabel: email },
  });
}

// ------------------------------------------------------------------
// 1. Valid login → 200 + session cookie + audit success
// ------------------------------------------------------------------
console.log('1. valid login');
{
  const res = await invoke(mockReq({ body: { email, password } }));
  assert(res.statusCode === 200, `200 OK (got ${res.statusCode})`);
  assert(res.body?.ok === true, 'response.ok=true');
  assert(res.body?.data?.user?.id === user.id, 'data.user.id matches');
  assert(res.body?.data?.user?.email === email, 'data.user.email matches');
  assert(
    res.body?.data?.user?.passwordHash === undefined,
    'passwordHash NOT in response',
  );
  assert(res.body?.data?.role?.id === role.id, 'data.role.id matches');

  const setCookie = res.getHeader('Set-Cookie');
  assert(typeof setCookie === 'string', 'Set-Cookie header set');
  assert(setCookie.includes(`${SESSION_COOKIE_NAME}=`), 'cookie has session name');
  assert(setCookie.includes('HttpOnly'), 'cookie HttpOnly');
  assert(setCookie.includes('SameSite=Lax'), 'cookie SameSite=Lax');

  // Extract token from cookie
  const tokenMatch = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  assert(tokenMatch !== null, 'token extractable from cookie');
  const cookieToken = decodeURIComponent(tokenMatch[1]);

  const dbSession = await prisma.session.findUnique({ where: { token: cookieToken } });
  assert(dbSession !== null, 'session row exists in DB');
  assert(dbSession.userId === user.id, 'session.userId matches');
  assert(dbSession.ipAddress === '203.0.113.42', 'session.ipAddress captured');

  const successCount = await countAudit('auth.login.success');
  assert(successCount === 1, `1 audit row for auth.login.success (got ${successCount})`);
}

// ------------------------------------------------------------------
// 2. Wrong password → 401 + audit failure (bad_password)
// ------------------------------------------------------------------
console.log('2. wrong password');
{
  const res = await invoke(mockReq({ body: { email, password: 'wrong-password' } }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.ok === false, 'response.ok=false');
  assert(res.body?.error === 'invalid_credentials', 'error=invalid_credentials');
  assert(res.getHeader('Set-Cookie') === undefined, 'no Set-Cookie on failure');

  const failedCount = await countAudit('auth.login.failed');
  assert(failedCount === 1, `1 audit row for auth.login.failed (got ${failedCount})`);

  const row = await prisma.auditLog.findFirst({
    where: { action: 'auth.login.failed', entityLabel: email },
    orderBy: { createdAt: 'desc' },
  });
  assert(row?.actorType === 'anonymous', 'actorType=anonymous');
  assert(row?.metadata?.reason === 'bad_password', 'metadata.reason=bad_password');
}

// ------------------------------------------------------------------
// 3. Unknown email → 401 (generic, no user enumeration)
// ------------------------------------------------------------------
console.log('3. unknown email');
{
  const res = await invoke(
    mockReq({ body: { email: `ghost+${suffix}@yalladj.test`, password: 'whatever' } }),
  );
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.body?.error === 'invalid_credentials', 'same error as bad password');
  assert(res.getHeader('Set-Cookie') === undefined, 'no Set-Cookie');
}

// ------------------------------------------------------------------
// 4. Inactive user → 401 (treated same as bad creds)
// ------------------------------------------------------------------
console.log('4. inactive user');
{
  await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
  const res = await invoke(mockReq({ body: { email, password } }));
  assert(res.statusCode === 401, `401 (got ${res.statusCode})`);
  assert(res.getHeader('Set-Cookie') === undefined, 'no Set-Cookie for inactive user');
  await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
}

// ------------------------------------------------------------------
// 5. Email case-insensitive (normalized to lowercase)
// ------------------------------------------------------------------
console.log('5. email case normalization');
{
  const res = await invoke(
    mockReq({ body: { email: email.toUpperCase(), password } }),
  );
  assert(res.statusCode === 200, `200 OK for uppercase email (got ${res.statusCode})`);
}

// ------------------------------------------------------------------
// 6. Missing fields → 400 validation
// ------------------------------------------------------------------
console.log('6. validation');
{
  const res1 = await invoke(mockReq({ body: { email: 'not-an-email', password: 'x' } }));
  assert(res1.statusCode === 400, `400 on invalid email (got ${res1.statusCode})`);
  assert(res1.body?.error === 'validation_failed', 'validation_failed error');

  const res2 = await invoke(mockReq({ body: { email, password: '' } }));
  assert(res2.statusCode === 400, `400 on empty password (got ${res2.statusCode})`);
}

// ------------------------------------------------------------------
// 7. Wrong method → 405
// ------------------------------------------------------------------
console.log('7. method routing');
{
  const res = mockRes();
  await loginHandler({ ...mockReq(), method: 'GET' }, res);
  assert(res.statusCode === 405, `405 on GET (got ${res.statusCode})`);
}

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
console.log('cleanup');
await prisma.$executeRaw`DELETE FROM audit_logs WHERE entity_label = ${email}`;
await prisma.$executeRaw`DELETE FROM sessions WHERE user_id = ${user.id}`;
await prisma.user.delete({ where: { id: user.id } });
await prisma.role.delete({ where: { id: role.id } });

console.log(`\nAll ${passed} login checks passed ✅`);
