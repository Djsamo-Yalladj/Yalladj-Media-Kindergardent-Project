// GET    /api/files/:id  — fetch one (sizeBytes as string)
// PATCH  /api/files/:id  — partial update (filename/url/label/isPublic/metadata/checksum)
// DELETE /api/files/:id  — soft delete. NOTE: does NOT delete bytes from storage;
//                          a background job should reconcile orphaned objects.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateFileSchema } from '../../src/schemas/content.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('file');
  return id;
}

function serialize<T extends { sizeBytes: bigint | null }>(f: T): Omit<T, 'sizeBytes'> & {
  sizeBytes: string | null;
} {
  return { ...f, sizeBytes: f.sizeBytes == null ? null : f.sizeBytes.toString() };
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const row = await prisma.file.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound('file');
  ok(res, serialize(row));
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateFileSchema, req.body);

  const existing = await prisma.file.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('file');

  const data: Prisma.FileUpdateInput = {};
  if (input.filename !== undefined) data.filename = input.filename;
  if (input.url !== undefined) data.url = input.url;
  if (input.label !== undefined) data.label = input.label;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.checksum !== undefined) data.checksum = input.checksum;
  if (input.metadata !== undefined) {
    data.metadata = (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue;
  }

  const row = await prisma.file.update({ where: { id }, data });

  await recordAudit({
    req,
    action: 'file.updated',
    entityTable: 'files',
    entityId: row.id,
    entityLabel: row.filename,
    before: existing,
    after: row,
    metadata: { patch: input },
  });

  ok(res, serialize(row));
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.file.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('file');

  await prisma.file.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'file.deleted',
    entityTable: 'files',
    entityId: id,
    entityLabel: existing.filename,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
