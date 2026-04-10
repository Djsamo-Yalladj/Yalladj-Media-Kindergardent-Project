// Session cookie helpers.
//
// The session token from src/lib/auth.ts rides in an HttpOnly cookie so JS on
// the page can't read it (defense against XSS token theft). We set SameSite=Lax
// to allow top-level navigations from email links while still blocking CSRF on
// cross-site POSTs. Secure is enabled in production only so local dev over http
// still works.
//
// No signing — the token itself is 256 bits of crypto-random entropy and is
// validated against the sessions table on every request. A signed cookie would
// add nothing beyond what the DB lookup already guarantees.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const SESSION_COOKIE_NAME = 'nursery_session';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function serializeCookie(
  name: string,
  value: string,
  opts: {
    expires?: Date;
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

/** Append a Set-Cookie header without clobbering any existing ones. */
function appendSetCookie(res: VercelResponse, cookie: string): void {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookie]);
  }
}

/** Set the session cookie. `expiresAt` should match the DB row's expires_at. */
export function setSessionCookie(
  res: VercelResponse,
  token: string,
  expiresAt: Date,
): void {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, token, {
      expires: expiresAt,
      maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
      httpOnly: true,
      secure: isProd(),
      sameSite: 'Lax',
      path: '/',
    }),
  );
}

/** Remove the session cookie client-side by expiring it immediately. */
export function clearSessionCookie(res: VercelResponse): void {
  appendSetCookie(
    res,
    serializeCookie(SESSION_COOKIE_NAME, '', {
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: isProd(),
      sameSite: 'Lax',
      path: '/',
    }),
  );
}

/** Parse a Cookie header into a key→value map. Returns {} on missing/empty. */
export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  if (!header) return {};
  const raw = Array.isArray(header) ? header.join('; ') : header;
  const out: Record<string, string> = {};
  for (const pair of raw.split(/;\s*/)) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    const value = pair.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/** Read the session token from the request's Cookie header, or null if absent. */
export function readSessionCookie(req: VercelRequest): string | null {
  const cookies = parseCookies(req.headers?.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  return token && token.length > 0 ? token : null;
}
