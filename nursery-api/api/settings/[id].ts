// GET    /api/settings/:id  — fetch one (id is the cuid, not the `key`)
// PATCH  /api/settings/:id  — partial update. Cannot change `key` (use key as stable
//                              handle); cannot change `isSystem` flag. System rows
//                              can be updated but not soft-deleted.
// DELETE /api/settings/:id  — soft delete. Refuses if row is isSystem=true.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateSettingSchema } from '../../src/schemas/content.js';

// Settings that are encrypted at rest should never have their value serialized
// into audit_logs. Swap for a redaction marker before diffing.
function redactIfEncrypted<T extends { isEncrypted: boolean; value: unknown }>(s: T): T {
  return s.isEncrypted ? { ...s, value: '[redacted]' } : s;
}

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('setting');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const row = await prisma.setting.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound('setting');
  ok(res, row);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateSettingSchema, req.body);

  const existing = await prisma.setting.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('setting');

  const data: Prisma.SettingUpdateInput = {};
  if (input.value !== undefined) {
    data.value = (input.value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (input.category !== undefined) data.category = input.category;
  if (input.label !== undefined) data.label = input.label;
  if (input.description !== undefined) data.description = input.description;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.isEncrypted !== undefined) data.isEncrypted = input.isEncrypted;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  const row = await prisma.setting.update({ where: { id }, data });

  await recordAudit({
    req,
    action: 'setting.updated',
    entityTable: 'settings',
    entityId: row.id,
    entityLabel: row.key,
    before: redactIfEncrypted(existing),
    after: redactIfEncrypted(row),
    // Patch may contain a plaintext value for encrypted settings — redact it too.
    metadata: {
      patch: existing.isEncrypted && 'value' in input ? { ...input, value: '[redacted]' } : input,
    },
  });

  ok(res, row);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.setting.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('setting');
  if (existing.isSystem) {
    throw new HttpError(400, 'system_setting', 'system settings cannot be deleted');
  }

  await prisma.setting.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'setting.deleted',
    entityTable: 'settings',
    entityId: id,
    entityLabel: existing.key,
    before: redactIfEncrypted(existing),
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
