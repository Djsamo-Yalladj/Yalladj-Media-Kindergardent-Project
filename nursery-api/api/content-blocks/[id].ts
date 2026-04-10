// GET    /api/content-blocks/:id  — fetch one
// PATCH  /api/content-blocks/:id  — partial update. `key` rename guarded by unique index.
// DELETE /api/content-blocks/:id  — soft delete
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import {
  route,
  parseBody,
  ok,
  notFound,
  HttpError,
  isUniqueViolation,
} from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateContentBlockSchema } from '../../src/schemas/content.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('content_block');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const row = await prisma.contentBlock.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound('content_block');
  ok(res, row);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateContentBlockSchema, req.body);

  const existing = await prisma.contentBlock.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('content_block');

  if (input.nurseryId) {
    const nursery = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!nursery) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  const data: Prisma.ContentBlockUpdateInput = {};
  if (input.key !== undefined) data.key = input.key;
  if (input.category !== undefined) data.category = input.category;
  if (input.titleEn !== undefined) data.titleEn = input.titleEn;
  if (input.titleAr !== undefined) data.titleAr = input.titleAr;
  if (input.bodyEn !== undefined) data.bodyEn = input.bodyEn;
  if (input.bodyAr !== undefined) data.bodyAr = input.bodyAr;
  if (input.mediaUrl !== undefined) data.mediaUrl = input.mediaUrl;
  if (input.metadata !== undefined) {
    data.metadata = (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.isGlobal !== undefined) data.isGlobal = input.isGlobal;
  if (input.nurseryId !== undefined) data.nurseryId = input.nurseryId;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  try {
    const row = await prisma.contentBlock.update({ where: { id }, data });
    await recordAudit({
      req,
      action: 'content_block.updated',
      entityTable: 'content_blocks',
      entityId: row.id,
      entityLabel: row.key,
      before: existing,
      after: row,
      metadata: { patch: input },
    });
    ok(res, row);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new HttpError(409, 'duplicate_key', 'a content_block with this key already exists');
    }
    throw err;
  }
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.contentBlock.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('content_block');

  await prisma.contentBlock.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'content_block.deleted',
    entityTable: 'content_blocks',
    entityId: id,
    entityLabel: existing.key,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
