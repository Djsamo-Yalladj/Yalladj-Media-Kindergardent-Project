// GET /api/auth/me — return the currently authenticated user + role.
//
// Response on success: 200 { ok: true, data: { user: {...}, role: {...} } }
// Response on failure: 401 { ok: false, error: 'unauthenticated' }
//
// Design notes:
// - attachSessionUser() in route() has already resolved req.user from the
//   session cookie. If it's missing, the cookie was absent, expired, or
//   pointed at a revoked / inactive / deleted user — all the same "not
//   signed in" to the caller.
// - We re-query the user row so the response shape matches /login exactly
//   (phone, avatarUrl, lastLoginAt are not on AuthedUser). The session
//   lookup already proved the user is active, so this is a cheap PK read
//   and a missing row would only happen on a race with deletion — treat
//   that as 401 too.
// - No audit row: /me is a read, called on every page load. Writing audit
//   here would drown the table in noise.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../src/lib/prisma.js';
import { route, ok, HttpError } from '../../src/lib/http.js';
import type { AuthedUser } from '../../src/lib/auth.js';

type AuthedRequest = VercelRequest & { user?: AuthedUser };

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

async function me(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authed = (req as AuthedRequest).user;
  if (!authed) {
    throw new HttpError(401, 'unauthenticated', 'sign in required');
  }

  const user = await prisma.user.findUnique({
    where: { id: authed.id },
    include: { role: true },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw new HttpError(401, 'unauthenticated', 'sign in required');
  }

  ok(res, {
    user: serializeUser(user),
    role: serializeRole(user.role),
  });
}

export default route({ GET: me });
