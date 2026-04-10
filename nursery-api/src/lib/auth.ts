// Session token create/validate/revoke for employee auth.
//
// Roll-our-own because KinderGardent-V1 is static HTML + serverless functions,
// not a framework with built-in session support. Tokens are 32-byte crypto-random
// hex strings stored in the `sessions` table with a 30-day TTL. No cookie logic
// here — that lives in B1-c (src/lib/cookies.ts) so this module stays pure and
// trivially testable.
//
// PrismaNeonHTTP has no transactions, so every call is a single write. Expired
// sessions are garbage-collected lazily inside getSessionByToken().

import { randomBytes } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';
import type { Role, Session, User } from '@prisma/client';
import { prisma } from './prisma.js';
import { readSessionCookie } from './cookies.js';

// 30 days. Long enough that employees don't get logged out mid-week; short
// enough that a stolen laptop eventually stops being a problem on its own.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionWithUser = {
  session: Session;
  user: User;
  role: Role;
};

function firstHeader(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getIp(req: VercelRequest): string | null {
  const xff = firstHeader(req.headers?.['x-forwarded-for']);
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  const real = firstHeader(req.headers?.['x-real-ip']);
  if (real) return real;
  const sock = (req as unknown as { socket?: { remoteAddress?: string } }).socket;
  return sock?.remoteAddress ?? null;
}

function getUserAgent(req: VercelRequest): string | null {
  return firstHeader(req.headers?.['user-agent']);
}

/** 32 random bytes → 64-char hex string. ~256 bits of entropy. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new session row for `userId` and return the plaintext token.
 * The token is only ever returned here — after this it's a hash-free lookup key.
 * Caller is responsible for delivering it to the client (cookie in B1-c).
 */
export async function createSession(
  userId: string,
  req?: VercelRequest,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: req ? getIp(req) : null,
      userAgent: req ? getUserAgent(req) : null,
    },
  });

  // Best-effort lastLoginAt update — failure here must not block login.
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // swallow — auth succeeded, stamp is non-critical
  }

  return { token, expiresAt };
}

/**
 * Look up a session by token. Returns null if not found, expired, or the user
 * is inactive/soft-deleted. Expired rows are deleted lazily on read.
 */
export async function getSessionByToken(token: string): Promise<SessionWithUser | null> {
  if (typeof token !== 'string' || token.length === 0) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { role: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    // Lazy GC — don't block the caller if the delete fails.
    try {
      await prisma.session.delete({ where: { id: session.id } });
    } catch {
      // ignore
    }
    return null;
  }

  if (!session.user || !session.user.isActive || session.user.deletedAt) {
    return null;
  }

  const { user, ...bareSession } = session;
  const { role, ...bareUser } = user;
  return { session: bareSession as Session, user: bareUser as User, role };
}

/**
 * Shape of `req.user` attached by attachSessionUser(). Compatible with the
 * MaybeAuthed type that src/lib/audit.ts already reads (id/label/type), while
 * also exposing the full role + session for route handlers that need them.
 */
export type AuthedUser = {
  id: string;
  label: string;
  type: 'user';
  email: string;
  name: string;
  roleId: string;
  role: Role;
  session: Session;
};

type AuthedRequest = VercelRequest & { user?: AuthedUser };

/** Read the session cookie + look up the session. Returns null if absent/invalid. */
export async function getSessionUser(req: VercelRequest): Promise<SessionWithUser | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  return getSessionByToken(token);
}

/**
 * Resolve the session cookie on `req` and stash a compact user object on
 * `req.user`. Called from http.ts route() so every handler and the audit
 * helper can pick up the actor with zero boilerplate. Errors are swallowed —
 * auth failures surface as anonymous (`req.user = undefined`), and the handler
 * decides whether that's allowed.
 */
export async function attachSessionUser(req: VercelRequest): Promise<void> {
  try {
    const loaded = await getSessionUser(req);
    if (!loaded) return;
    (req as AuthedRequest).user = {
      id: loaded.user.id,
      label: loaded.user.name,
      type: 'user',
      email: loaded.user.email,
      name: loaded.user.name,
      roleId: loaded.user.roleId,
      role: loaded.role,
      session: loaded.session,
    };
  } catch {
    // DB hiccup — treat as anonymous, don't break the request
  }
}

/** Delete a single session. Safe to call on an unknown token. */
export async function revokeSession(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) return;
  try {
    await prisma.session.delete({ where: { token } });
  } catch {
    // not found — nothing to revoke
  }
}

/**
 * Delete every session for a user. Used for password reset / "log out everywhere".
 * Uses $executeRaw because the HTTP adapter does not support deleteMany.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  if (typeof userId !== 'string' || userId.length === 0) return 0;
  const result = await prisma.$executeRaw`DELETE FROM sessions WHERE user_id = ${userId}`;
  return typeof result === 'number' ? result : 0;
}
