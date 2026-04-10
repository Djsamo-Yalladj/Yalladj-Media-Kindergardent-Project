// POST /api/auth/logout — revoke the current session + clear the cookie.
//
// Response: 200 { ok: true, data: { loggedOut: true } } in every path.
//
// Design notes:
// - Idempotent by design. Calling logout without a cookie, with a stale
//   cookie, or with an already-revoked token all succeed with 200. The
//   contract is "after this call you are signed out" — which is true
//   either way. Returning 401 would force the frontend to special-case
//   the "already logged out" state for no benefit.
// - clearSessionCookie() always runs so the browser drops whatever it
//   was holding, even if the DB row was already gone.
// - Audit is written ONLY when a verified session was revoked (req.user
//   is present). Anonymous/no-cookie calls do not spam audit_logs.
// - attachSessionUser() runs inside route() before this handler, so by
//   the time we're here req.user is either a real authed user or
//   undefined. We still read the raw cookie token to pass to
//   revokeSession — req.user.session.token would also work, but reading
//   the cookie is one less field to remember and works in the edge case
//   where the session row was valid at attachSessionUser time but
//   expired/removed between then and here.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { route, ok } from '../../src/lib/http.js';
import { revokeSession, type AuthedUser } from '../../src/lib/auth.js';
import { readSessionCookie, clearSessionCookie } from '../../src/lib/cookies.js';
import { recordAudit } from '../../src/lib/audit.js';

type AuthedRequest = VercelRequest & { user?: AuthedUser };

async function logout(req: VercelRequest, res: VercelResponse): Promise<void> {
  const token = readSessionCookie(req);
  const authed = (req as AuthedRequest).user;

  // Revoke DB row if we had a token. Safe on unknown/expired tokens.
  if (token) {
    await revokeSession(token);
  }

  // Always clear the browser cookie, even when there was nothing to revoke.
  clearSessionCookie(res);

  // Only audit real logouts — anonymous calls are no-ops and shouldn't
  // fill audit_logs with noise. `authed` is set by attachSessionUser()
  // in route() when the cookie resolved to a valid session+user.
  if (authed) {
    await recordAudit({
      req,
      actorType: 'user',
      actorId: authed.id,
      actorLabel: authed.name,
      action: 'auth.logout.success',
      entityTable: 'users',
      entityId: authed.id,
      entityLabel: authed.email,
      metadata: { sessionId: authed.session.id },
    });
  }

  ok(res, { loggedOut: true });
}

export default route({ POST: logout });
