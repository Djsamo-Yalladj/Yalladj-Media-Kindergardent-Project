// B3 smoke test: login rate limiting
//
// Two layers of checks:
//   1. Direct checkLoginRateLimit() unit tests — seed synthetic audit rows
//      and verify the counter logic (fast, no bcrypt).
//   2. One end-to-end run through the login handler to confirm the wiring:
//      bad password 10× → 11th returns 429 + Retry-After + audit row.
//
// Direct tests cover: email window, IP window, success-resets-email counter,
// IP counter does NOT reset on success, isolation between IPs/emails, the
// fail-open behavior on DB errors (skipped — hard to simulate cleanly here).

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const { prisma } = await import('../src/lib/prisma.ts');
const { hashPassword } = await import('../src/lib/password.ts');
const {
  checkLoginRateLimit,
  LOGIN_RATE_MAX_PER_EMAIL,
  LOGIN_RATE_MAX_PER_IP,
  LOGIN_RATE_WINDOW_MS,
} = await import('../src/lib/auth.ts');
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

function mockReq({ body = {}, ip = '198.51.100.10' } = {}) {
  return {
    method: 'POST',
    query: {},
    body,
    headers: {
      'user-agent': 'ratelimit-smoke-test/1.0',
      'x-forwarded-for': ip,
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

// Seed a synthetic audit_logs row directly. Bypasses recordAudit() so we
// control createdAt, ipAddress, and entityLabel exactly.
async function seedFailedRow({ email, ip, offsetMs = 0 }) {
  const createdAt = new Date(Date.now() - offsetMs);
  await prisma.auditLog.create({
    data: {
      actorType: 'anonymous',
      actorLabel: email,
      action: 'auth.login.failed',
      entityTable: 'users',
      entityLabel: email,
      ipAddress: ip,
      metadata: { reason: 'test_seed' },
      createdAt,
    },
  });
}

async function seedSuccessRow({ email, ip, offsetMs = 0 }) {
  const createdAt = new Date(Date.now() - offsetMs);
  await prisma.auditLog.create({
    data: {
      actorType: 'user',
      actorLabel: email,
      action: 'auth.login.success',
      entityTable: 'users',
      entityLabel: email,
      ipAddress: ip,
      metadata: { reason: 'test_seed' },
      createdAt,
    },
  });
}

const suffix = Date.now();

// ------------------------------------------------------------------
// Setup — one real user so the end-to-end test has something to hit
// ------------------------------------------------------------------
const role = await prisma.role.create({
  data: {
    name: `ratelimit-test-${suffix}`,
    label: { en: 'Rate Limit Test Role', ar: 'دور اختبار' },
    permissions: {},
    isSystem: false,
  },
});

const realEmail = `ratelimit+${suffix}@yalladj.test`;
const realPassword = 'correct-horse-battery-staple';
const user = await prisma.user.create({
  data: {
    email: realEmail,
    passwordHash: await hashPassword(realPassword),
    name: 'Rate Limit Test User',
    roleId: role.id,
  },
});

// Track every email we touch so cleanup can scrub audit rows
const touchedEmails = new Set([realEmail]);
const touchedIps = new Set();

// ------------------------------------------------------------------
// 1. Per-email counter
// ------------------------------------------------------------------
console.log('1. per-email counter');
{
  const email = `email-win+${suffix}@yalladj.test`;
  const ip = '198.51.100.20';
  touchedEmails.add(email);
  touchedIps.add(ip);

  // Fresh email, no rows → allowed
  let r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === true, 'fresh email allowed');

  // Seed max-1 failures → still allowed
  for (let i = 0; i < LOGIN_RATE_MAX_PER_EMAIL - 1; i++) {
    await seedFailedRow({ email, ip });
  }
  r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === true, `${LOGIN_RATE_MAX_PER_EMAIL - 1} fails still allowed`);

  // One more → blocked
  await seedFailedRow({ email, ip });
  r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === false, `${LOGIN_RATE_MAX_PER_EMAIL} fails → blocked`);
  assert(r.reason === 'email', 'reason=email');
  assert(
    r.retryAfterSec === Math.ceil(LOGIN_RATE_WINDOW_MS / 1000),
    `retryAfterSec = ${Math.ceil(LOGIN_RATE_WINDOW_MS / 1000)}`,
  );
}

// ------------------------------------------------------------------
// 2. Old failures (outside window) are ignored
// ------------------------------------------------------------------
console.log('2. window boundary');
{
  const email = `window+${suffix}@yalladj.test`;
  const ip = '198.51.100.21';
  touchedEmails.add(email);
  touchedIps.add(ip);

  // Seed 20 fails but all OUTSIDE the window (offsetMs > window)
  for (let i = 0; i < 20; i++) {
    await seedFailedRow({ email, ip, offsetMs: LOGIN_RATE_WINDOW_MS + 60_000 });
  }
  const r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === true, 'stale failures outside window are ignored');
}

// ------------------------------------------------------------------
// 3. Success resets per-email counter
// ------------------------------------------------------------------
console.log('3. success resets email counter');
{
  const email = `reset+${suffix}@yalladj.test`;
  const ip = '198.51.100.22';
  touchedEmails.add(email);
  touchedIps.add(ip);

  // Pile up max failures → blocked
  for (let i = 0; i < LOGIN_RATE_MAX_PER_EMAIL; i++) {
    await seedFailedRow({ email, ip, offsetMs: 5000 + i });
  }
  let r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === false, 'locked out pre-success');

  // A success row newer than all the failures resets the counter
  await seedSuccessRow({ email, ip, offsetMs: 1000 });
  r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === true, 'success row resets per-email counter');

  // New failures AFTER the success start counting from zero
  for (let i = 0; i < LOGIN_RATE_MAX_PER_EMAIL - 1; i++) {
    await seedFailedRow({ email, ip, offsetMs: 500 - i });
  }
  r = await checkLoginRateLimit(mockReq({ ip }), email);
  assert(r.allowed === true, 'post-success fails count from 0');
}

// ------------------------------------------------------------------
// 4. Per-IP counter (many emails, same IP)
// ------------------------------------------------------------------
console.log('4. per-IP counter');
{
  const ip = '198.51.100.30';
  touchedIps.add(ip);

  // Seed MAX_PER_IP failures spread across distinct emails
  for (let i = 0; i < LOGIN_RATE_MAX_PER_IP; i++) {
    const e = `ipburst-${i}+${suffix}@yalladj.test`;
    touchedEmails.add(e);
    await seedFailedRow({ email: e, ip });
  }

  // Any new email from this IP → blocked by IP rule (not email rule)
  const probeEmail = `ipprobe+${suffix}@yalladj.test`;
  touchedEmails.add(probeEmail);
  const r = await checkLoginRateLimit(mockReq({ ip }), probeEmail);
  assert(r.allowed === false, 'IP lockout triggers on fresh email');
  assert(r.reason === 'ip', 'reason=ip');
}

// ------------------------------------------------------------------
// 5. IP isolation — different IP, same email situation, is unaffected
// ------------------------------------------------------------------
console.log('5. IP isolation');
{
  const freshIp = '198.51.100.31';
  touchedIps.add(freshIp);
  const probeEmail = `isolated+${suffix}@yalladj.test`;
  touchedEmails.add(probeEmail);
  const r = await checkLoginRateLimit(mockReq({ ip: freshIp }), probeEmail);
  assert(r.allowed === true, 'different IP is not affected by other IP lockouts');
}

// ------------------------------------------------------------------
// 6. Success does NOT reset per-IP counter
// ------------------------------------------------------------------
console.log('6. success does NOT reset per-IP');
{
  const ip = '198.51.100.40';
  touchedIps.add(ip);

  // Seed MAX_PER_IP failures across distinct emails
  for (let i = 0; i < LOGIN_RATE_MAX_PER_IP; i++) {
    const e = `ipnoreset-${i}+${suffix}@yalladj.test`;
    touchedEmails.add(e);
    await seedFailedRow({ email: e, ip });
  }

  // A legit success from the same IP
  const successEmail = `ipnoreset-success+${suffix}@yalladj.test`;
  touchedEmails.add(successEmail);
  await seedSuccessRow({ email: successEmail, ip });

  // Still blocked — success must not wash out an attacker's IP count
  const probeEmail = `ipnoreset-probe+${suffix}@yalladj.test`;
  touchedEmails.add(probeEmail);
  const r = await checkLoginRateLimit(mockReq({ ip }), probeEmail);
  assert(r.allowed === false, 'IP still locked after success from same IP');
  assert(r.reason === 'ip', 'reason still ip');
}

// ------------------------------------------------------------------
// 7. End-to-end through login handler: 10 bad → 11th returns 429
// ------------------------------------------------------------------
console.log('7. end-to-end handler lockout');
{
  const ip = '198.51.100.50';
  touchedIps.add(ip);

  // Use the REAL user, wrong password, fresh IP — triggers email lockout
  // (which hits first because the email counter fills at 10 before IP at 20).
  for (let i = 0; i < LOGIN_RATE_MAX_PER_EMAIL; i++) {
    const res = mockRes();
    await loginHandler(
      mockReq({ body: { email: realEmail, password: 'wrong-pw' }, ip }),
      res,
    );
    assert(res.statusCode === 401, `attempt ${i + 1}: 401 bad password`);
  }

  // 11th attempt → 429
  const locked = mockRes();
  await loginHandler(
    mockReq({ body: { email: realEmail, password: 'wrong-pw' }, ip }),
    locked,
  );
  assert(locked.statusCode === 429, `11th attempt: 429 (got ${locked.statusCode})`);
  assert(locked.body?.error === 'rate_limited', 'error=rate_limited');
  assert(
    typeof locked.getHeader('Retry-After') === 'string',
    'Retry-After header set',
  );
  assert(
    Number.parseInt(locked.getHeader('Retry-After'), 10) > 0,
    'Retry-After is a positive integer',
  );

  // Even the CORRECT password is locked out
  const lockedValid = mockRes();
  await loginHandler(
    mockReq({ body: { email: realEmail, password: realPassword }, ip }),
    lockedValid,
  );
  assert(
    lockedValid.statusCode === 429,
    'valid password during lockout still returns 429',
  );

  // Audit row for rate_limited was written
  const rlCount = await prisma.auditLog.count({
    where: { action: 'auth.login.rate_limited', entityLabel: realEmail },
  });
  assert(rlCount >= 2, `≥2 auth.login.rate_limited rows (got ${rlCount})`);
}

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
console.log('cleanup');
for (const e of touchedEmails) {
  await prisma.$executeRaw`DELETE FROM audit_logs WHERE entity_label = ${e}`;
}
await prisma.$executeRaw`DELETE FROM sessions WHERE user_id = ${user.id}`;
await prisma.user.delete({ where: { id: user.id } });
await prisma.role.delete({ where: { id: role.id } });

console.log(`\nAll ${passed} rate-limit checks passed ✅`);
