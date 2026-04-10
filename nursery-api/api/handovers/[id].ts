// GET    /api/handovers/:id  — fetch one
// PATCH  /api/handovers/:id  — partial update (acknowledge, attach archive, etc.)
// DELETE /api/handovers/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateHandoverSchema } from '../../src/schemas/ticket.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('handover');
  return id;
}

function serialize<T extends { sizeBytes: bigint | null }>(h: T): Omit<T, 'sizeBytes'> & {
  sizeBytes: string | null;
} {
  return { ...h, sizeBytes: h.sizeBytes == null ? null : h.sizeBytes.toString() };
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const handover = await prisma.handover.findFirst({ where: { id, deletedAt: null } });
  if (!handover) notFound('handover');
  ok(res, serialize(handover));
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateHandoverSchema, req.body);

  const existing = await prisma.handover.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('handover');

  if (input.nurseryId && input.nurseryId !== existing.nurseryId) {
    const n = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!n) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  if (input.projectId) {
    const targetNurseryId = input.nurseryId ?? existing.nurseryId;
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, nurseryId: true },
    });
    if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');
    if (project.nurseryId !== targetNurseryId) {
      throw new HttpError(
        400,
        'project_nursery_mismatch',
        'project does not belong to the given nursery',
      );
    }
  }

  const data: Prisma.HandoverUpdateInput = {};
  if (input.type !== undefined) data.type = input.type;
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.archiveUrl !== undefined) data.archiveUrl = input.archiveUrl;
  if (input.manifest !== undefined) data.manifest = input.manifest as Prisma.InputJsonValue;
  if (input.sizeBytes !== undefined) {
    data.sizeBytes = input.sizeBytes != null ? BigInt(input.sizeBytes) : null;
  }
  if (input.deliveredAt !== undefined) {
    data.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : null;
  }
  if (input.deliveredToEmail !== undefined) data.deliveredToEmail = input.deliveredToEmail;
  if (input.acknowledgedAt !== undefined) {
    data.acknowledgedAt = input.acknowledgedAt ? new Date(input.acknowledgedAt) : null;
  }
  if (input.nurseryId !== undefined) data.nurseryId = input.nurseryId;
  if (input.projectId !== undefined) data.projectId = input.projectId;

  const handover = await prisma.handover.update({ where: { id }, data });

  await recordAudit({
    req,
    action: 'handover.updated',
    entityTable: 'handovers',
    entityId: handover.id,
    entityLabel: handover.title,
    before: existing,
    after: handover,
    metadata: { patch: input },
  });

  ok(res, serialize(handover));
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.handover.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('handover');

  await prisma.handover.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'handover.deleted',
    entityTable: 'handovers',
    entityId: id,
    entityLabel: existing.title,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
