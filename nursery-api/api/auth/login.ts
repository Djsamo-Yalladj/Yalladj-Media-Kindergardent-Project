// POST /api/auth/login — email + password → session cookie.
//
// Response on success: { ok: true, data: { user: {...}, role: {...} } }
// Response on failure: 401 { ok: false, error: 'invalid_credentials' }
//
// Security notes:
// - We return a GENERIC 401 for both "email not found" and "wrong password"
//   so attackers can't enumerate valid accounts. We also run the bcrypt
//   verify even on unknown emails (against a dummy hash) to keep the
//   response-time signal flat — otherwise a failed lookup would return
//   ~250ms faster than a bad password, which is a timing oracle.
// - Session cookie is HttpOnly + SameSite=Lax + Secure-in-prod. Set by
//   cookies.setSessionCookie() in src/lib/cookies.ts.
// - passwordHash is NEVER included in the response payload.
// - Audit rows are written for BOTH success and failure paths so Phase C
//   (audit tool) can surface brute-force attempts. Actor on failure is
//   'anonymous' since there's no verified identity yet.
//
// Rate limiting (Phase B3): checkLoginRateLimit() is called BEFORE the
// bcrypt compare. Exceeding either window (10/email or 20/IP in 15 min)
// returns 429 with a Retry-After header and writes an
// `auth.login.rate_limited` audit row. Timing is still flat for the
// allowed path — the rate check runs on every request, locked or not.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, HttpError } from '../../src/lib/http.js';
import { verifyPassword } from '../../src/lib/password.js';
import { checkLoginRateLimit, createSession } from '../../src/lib/auth.js';
import { setSessionCookie } from '../../src/lib/cookies.js';
import { recordAudit } from '../../src/lib/audit.js';
import { loginBodySchema } from '../../src/schemas/auth.js';

// A valid bcrypt hash of a random string. Used only to keep timing flat on
// unknown-email path — verifyPassword against this always returns false at
// the same cost as a real hash comparison. Cost 12 matches password.ts.
const DUMMY_HASH =
  '$2a$12$CjwlM0Z.KrQmB3n7E5f9o.1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6';

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  roleId: string;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roleId: user.roleId,
    lastLoginAt: user.lastLoginAt,
  };
}

function serializeRole(role: {
  id: string;
  name: string;
  label: unknown;
  permissions: unknown;
}) {
  return {
    id: role.id,
    name: role.name,
    label: role.label,
    permissions: role.permissions,
  };
}

async function login(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { email, password } = parseBody(loginBodySchema, req.body);

  // Rate-limit check runs before the password lookup — a locked-out caller
  // doesn't get to trigger a bcrypt compare or a DB lookup for the user row.
  const rate = await checkLoginRateLimit(req, email);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSec));
    await recordAudit({
      req,
      actorType: 'anonymous',
      actorLabel: email,
      action: 'auth.login.rate_limited',
      entityTable: 'users',
      entityId: null,
      entityLabel: email,
      metadata: { reason: rate.reason, retryAfterSec: rate.retryAfterSec },
    });
    throw new HttpError(429, 'rate_limited', 'too many login attempts, try again later');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // Active user required. Inactive or soft-deleted → treat as invalid creds.
  const candidate =
    user && user.isActive && !user.deletedAt ? user : null;

  // Always run bcrypt compare to keep timing flat.
  const hashToCheck = candidate?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!candidate || !passwordOk) {
    // Audit the failed attempt. entityId is the email (not a user id) —
    // we don't want to leak whether the email existed via the audit row.
    await recordAudit({
      req,
      actorType: 'anonymous',
      actorLabel: email,
      action: 'auth.login.failed',
      entityTable: 'users',
      entityId: null,
      entityLabel: email,
      metadata: { reason: !candidate ? 'unknown_email_or_inactive' : 'bad_password' },
    });
    throw new HttpError(401, 'invalid_credentials', 'email or password is incorrect');
  }

  // Issue session + set cookie.
  const { token, expiresAt } = await createSession(candidate.id, req);
  setSessionCookie(res, token, expiresAt);

  await recordAudit({
    req,
    actorType: 'user',
    actorId: candidate.id,
    actorLabel: candidate.name,
    action: 'auth.login.success',
    entityTable: 'users',
    entityId: candidate.id,
    entityLabel: candidate.email,
    metadata: { sessionExpiresAt: expiresAt.toISOString() },
  });

  ok(res, {
    user: serializeUser(candidate),
    role: serializeRole(candidate.role),
  });
}

export default route({ POST: login });
