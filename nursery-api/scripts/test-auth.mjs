// B1-e smoke test: auth.ts + cookies.ts end-to-end.
//
// Covers session create / validate / revoke, expired-session GC, cookie
// round-trip, and req.user attachment via attachSessionUser().
//
// Creates a throwaway role + user, exercises every helper, then cleans up.

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { hashPassword } = await import('../src/lib/password.ts');
const {
  createSession,
  getSessionByToken,
  revokeSession,
  revokeAllUserSessions,
  attachSessionUser,
  SESSION_TTL_MS,
} = await import('../src/lib/auth.ts');
const {
  SESSION_COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  parseCookies,
  readSessionCookie,
} = await import('../src/lib/cookies.ts');

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  passed += 1;
}

function mockReq({ headers = {} } = {}) {
  return {
    method: 'GET',
    query: {},
    headers: {
      'user-agent': 'auth-smoke-test/1.0',
      'x-forwarded-for': '198.51.100.9',
      ...headers,
    },
  };
}

function mockRes() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
}

// ------------------------------------------------------------------
// Setup: throwaway role + user
// ------------------------------------------------------------------
const suffix = Date.now();
const role = await prisma.role.create({
  data: {
    name: `test-role-${suffix}`,
    label: { en: 'Test Role', ar: 'دور اختبار' },
    permissions: {},
    isSystem: false,
  },
});

const user = await prisma.user.create({
  data: {
    email: `auth-smoke+${suffix}@yalladj.test`,
    passwordHash: await hashPassword('correct-horse-battery'),
    name: 'Auth Smoke User',
    roleId: role.id,
  },
});

// ------------------------------------------------------------------
// 1. createSession
// ------------------------------------------------------------------
console.log('1. createSession');
const req1 = mockReq();
const { token, expiresAt } = await createSession(user.id, req1);
assert(typeof token === 'string', 'token is a string');
assert(/^[0-9a-f]{64}$/.test(token), 'token is 64-char hex');
const ttlDelta = expiresAt.getTime() - Date.now();
assert(
  ttlDelta > SESSION_TTL_MS - 60_000 && ttlDelta <= SESSION_TTL_MS,
  `expiresAt ≈ now + 30d (delta=${ttlDelta})`,
);

const dbRow = await prisma.session.findUnique({ where: { token } });
assert(dbRow !== null, 'session row exists in DB');
assert(dbRow.userId === user.id, 'row.userId matches');
assert(dbRow.ipAddress === '198.51.100.9', `row.ipAddress captured (got ${dbRow.ipAddress})`);
assert(dbRow.userAgent === 'auth-smoke-test/1.0', 'row.userAgent captured');

const stamped = await prisma.user.findUnique({ where: { id: user.id } });
assert(stamped.lastLoginAt !== null, 'lastLoginAt stamped');

// ------------------------------------------------------------------
// 2. getSessionByToken — valid / unknown
// ------------------------------------------------------------------
console.log('2. getSessionByToken');
const loaded = await getSessionByToken(token);
assert(loaded !== null, 'valid token loads');
assert(loaded.user.id === user.id, 'loaded.user.id matches');
assert(loaded.role.id === role.id, 'loaded.role.id matches');
assert(loaded.session.token === token, 'loaded.session.token matches');

const missing = await getSessionByToken('deadbeef'.repeat(8));
assert(missing === null, 'unknown token → null');

const emptyCheck = await getSessionByToken('');
assert(emptyCheck === null, 'empty token → null');

// ------------------------------------------------------------------
// 3. Expired session → null + auto-GC
// ------------------------------------------------------------------
console.log('3. expired session GC');
const expiredToken = `expired${suffix}`.padEnd(64, '0');
await prisma.session.create({
  data: {
    userId: user.id,
    token: expiredToken,
    expiresAt: new Date(Date.now() - 1000),
  },
});
const expiredResult = await getSessionByToken(expiredToken);
assert(expiredResult === null, 'expired session → null');
const expiredRow = await prisma.session.findUnique({ where: { token: expiredToken } });
assert(expiredRow === null, 'expired row auto-deleted');

// ------------------------------------------------------------------
// 4. Inactive user → null
// ------------------------------------------------------------------
console.log('4. inactive user blocks session');
await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
const blocked = await getSessionByToken(token);
assert(blocked === null, 'inactive user → session rejected');
await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });

// ------------------------------------------------------------------
// 5. revokeSession
// ------------------------------------------------------------------
console.log('5. revokeSession');
const { token: t2 } = await createSession(user.id);
await revokeSession(t2);
const afterRevoke = await prisma.session.findUnique({ where: { token: t2 } });
assert(afterRevoke === null, 'revoked session gone');
await revokeSession('not-a-real-token'); // should not throw
assert(true, 'revokeSession on unknown token is safe');

// ------------------------------------------------------------------
// 6. revokeAllUserSessions
// ------------------------------------------------------------------
console.log('6. revokeAllUserSessions');
await createSession(user.id);
await createSession(user.id);
await createSession(user.id);
const before = await prisma.session.count({ where: { userId: user.id } });
assert(before >= 3, `expected ≥3 sessions before revokeAll, got ${before}`);
const deleted = await revokeAllUserSessions(user.id);
assert(deleted >= before, `revokeAllUserSessions deleted ${deleted} (expected ≥${before})`);
const after = await prisma.session.count({ where: { userId: user.id } });
assert(after === 0, 'zero sessions remain');

// ------------------------------------------------------------------
// 7. Cookie round-trip
// ------------------------------------------------------------------
console.log('7. cookie round-trip');
const { token: t3, expiresAt: exp3 } = await createSession(user.id);
const res = mockRes();
setSessionCookie(res, t3, exp3);
const setHeader = res.getHeader('Set-Cookie');
assert(typeof setHeader === 'string', 'Set-Cookie header set');
assert(setHeader.includes('HttpOnly'), 'cookie is HttpOnly');
assert(setHeader.includes('SameSite=Lax'), 'cookie is SameSite=Lax');
assert(setHeader.includes(`${SESSION_COOKIE_NAME}=`), 'cookie name correct');
assert(setHeader.includes('Path=/'), 'cookie has Path=/');

// Parse back the same header as if the client sent it
const cookieHeader = setHeader.split(';')[0]; // "nursery_session=TOKEN"
const parsed = parseCookies(cookieHeader);
assert(parsed[SESSION_COOKIE_NAME] === t3, 'parseCookies round-trips token');

const req2 = mockReq({ headers: { cookie: cookieHeader } });
const readToken = readSessionCookie(req2);
assert(readToken === t3, 'readSessionCookie returns token');

// Append another Set-Cookie, ensure existing one survives
setSessionCookie(res, t3, exp3);
const multi = res.getHeader('Set-Cookie');
assert(Array.isArray(multi) && multi.length === 2, 'appendSetCookie preserves existing');

// clearSessionCookie
const res2 = mockRes();
clearSessionCookie(res2);
const cleared = res2.getHeader('Set-Cookie');
assert(cleared.includes('Max-Age=0'), 'clear cookie has Max-Age=0');

// ------------------------------------------------------------------
// 8. attachSessionUser(req) middleware
// ------------------------------------------------------------------
console.log('8. attachSessionUser');

const reqAnon = mockReq();
await attachSessionUser(reqAnon);
assert(reqAnon.user === undefined, 'no cookie → req.user undefined');

const reqAuthed = mockReq({ headers: { cookie: `${SESSION_COOKIE_NAME}=${t3}` } });
await attachSessionUser(reqAuthed);
assert(reqAuthed.user !== undefined, 'valid cookie → req.user populated');
assert(reqAuthed.user.id === user.id, 'req.user.id matches');
assert(reqAuthed.user.type === 'user', 'req.user.type=user (not system)');
assert(reqAuthed.user.label === 'Auth Smoke User', 'req.user.label = user.name');
assert(reqAuthed.user.role.id === role.id, 'req.user.role attached');

const reqBad = mockReq({ headers: { cookie: `${SESSION_COOKIE_NAME}=nope-${suffix}` } });
await attachSessionUser(reqBad);
assert(reqBad.user === undefined, 'bad token → req.user undefined');

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
console.log('cleanup');
await revokeAllUserSessions(user.id);
await prisma.user.delete({ where: { id: user.id } });
await prisma.role.delete({ where: { id: role.id } });

console.log(`\nAll ${passed} auth checks passed ✅`);
