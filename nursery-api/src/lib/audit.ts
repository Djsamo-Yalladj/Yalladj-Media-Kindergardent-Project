// Append-only audit_logs helper.
//
// Usage: `await recordAudit({ req, action, entityTable, entityId, entityLabel, after })`
// from every mutation endpoint, AFTER the primary write has succeeded. The helper
// catches its own errors — an audit_logs failure must NOT fail the parent request
// (PrismaNeonHTTP has no transactions, so there is no way to atomically commit both
// writes; we log-and-swallow here and the application-level smoke tests assert the
// audit row shows up on happy paths).
//
// Actor resolution (Phase A): there is no auth yet, so we default to `system`.
// Callers can override via actorType/actorId/actorLabel. Once Phase B adds auth,
// the route() wrapper in http.ts will attach `req.user` and this helper will pick
// it up automatically.

import type { VercelRequest } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type AuditActor = {
  actorType?: string;
  actorId?: string | null;
  actorLabel?: string | null;
};

export type AuditInput = AuditActor & {
  req?: VercelRequest;
  action: string; // e.g. "lead.created", "project.stage_changed"
  entityTable?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  /** Previous state for updates/deletes (null if none). */
  before?: unknown;
  /** New state for creates/updates (null if none). */
  after?: unknown;
  /** Free-form extra context (e.g. patch payload, stage transition from→to). */
  metadata?: unknown;
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

// Phase B placeholder: once auth middleware attaches req.user we read it here.
type MaybeAuthed = VercelRequest & {
  user?: { id?: string; label?: string; type?: string };
};

function resolveActor(req: VercelRequest | undefined, override: AuditActor): Required<AuditActor> {
  const authed = (req as MaybeAuthed | undefined)?.user;
  return {
    actorType: override.actorType ?? authed?.type ?? 'system',
    actorId: override.actorId !== undefined ? override.actorId : (authed?.id ?? null),
    actorLabel:
      override.actorLabel !== undefined ? override.actorLabel : (authed?.label ?? null),
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  // JSON.stringify handles BigInt poorly — serialize bigints as strings first.
  const normalized = JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
  return normalized as Prisma.InputJsonValue;
}

/**
 * Write an append-only audit_logs row. Never throws — errors are logged and
 * swallowed so a broken audit pipeline can't block writes. Callers should
 * `await` this anyway so the row is persisted before the response returns.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const actor = resolveActor(input.req, {
      actorType: input.actorType,
      actorId: input.actorId,
      actorLabel: input.actorLabel,
    });

    const hasChanges = input.before !== undefined || input.after !== undefined;
    const changes = hasChanges
      ? (toJson({ before: input.before ?? null, after: input.after ?? null }))
      : Prisma.JsonNull;

    await prisma.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        actorLabel: actor.actorLabel,
        action: input.action,
        entityTable: input.entityTable ?? null,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        changes,
        metadata: toJson(input.metadata),
        ipAddress: input.req ? getIp(input.req) : null,
        userAgent: input.req ? getUserAgent(input.req) : null,
      },
    });
  } catch (err) {
    // Never rethrow — audit_logs is append-only instrumentation, not critical path.
    console.error('[audit] failed to write audit_log', {
      action: input.action,
      entityTable: input.entityTable,
      entityId: input.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
