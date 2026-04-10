// Shared HTTP helpers: method routing, error shape, Zod error translation.
// Keep thin — real middleware (auth, rate limits) lands in Phase B.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError, type ZodType } from 'zod';

export type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => Promise<void> | void;

export type MethodMap = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>>;

/**
 * Routes by HTTP method. Returns 405 for unsupported verbs.
 * Catches thrown errors and translates them into a consistent JSON shape.
 */
export function route(map: MethodMap): Handler {
  return async (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase() as keyof MethodMap;
    const handler = map[method];
    if (!handler) {
      res.setHeader('Allow', Object.keys(map).join(', '));
      res.status(405).json({ ok: false, error: `Method ${method} not allowed` });
      return;
    }
    try {
      await handler(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };
}

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: 'validation_failed',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, error: err.code, message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'unknown error';
  res.status(500).json({ ok: false, error: 'internal_error', message });
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function notFound(what: string): never {
  throw new HttpError(404, 'not_found', `${what} not found`);
}

/**
 * Unique-constraint violation detector.
 * Prisma's driverAdapter/Neon HTTP path surfaces Postgres SQLSTATE "23505"
 * instead of Prisma's native "P2002", so we check both.
 */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return code === 'P2002' || code === '23505';
}

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body ?? {});
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  return schema.parse(query ?? {});
}

export function ok<T>(res: VercelResponse, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}
