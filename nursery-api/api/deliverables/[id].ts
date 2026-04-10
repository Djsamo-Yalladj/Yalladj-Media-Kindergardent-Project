// GET    /api/deliverables/:id  — fetch one
// PATCH  /api/deliverables/:id  — partial update. Auto-stamps approvedAt when
//                                  flipping isApproved=true (unless caller sets it).
// DELETE /api/deliverables/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateDeliverableSchema } from '../../src/schemas/content.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('deliverable');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const row = await prisma.deliverable.findFirst({ where: { id, deletedAt: null } });
  if (!row) notFound('deliverable');
  ok(res, row);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateDeliverableSchema, req.body);

  const existing = await prisma.deliverable.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('deliverable');

  if (input.projectId && input.projectId !== existing.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');
  }

  const data: Prisma.DeliverableUpdateInput = {};
  if (input.projectId !== undefined) data.project = { connect: { id: input.projectId } };
  if (input.title !== undefined) data.title = input.title;
  if (input.titleAr !== undefined) data.titleAr = input.titleAr;
  if (input.description !== undefined) data.description = input.description;
  if (input.type !== undefined) data.type = input.type;
  if (input.fileUrl !== undefined) data.fileUrl = input.fileUrl;
  if (input.previewUrl !== undefined) data.previewUrl = input.previewUrl;
  if (input.version !== undefined) data.version = input.version;
  if (input.approvedById !== undefined) data.approvedById = input.approvedById;
  if (input.deliveredAt !== undefined) {
    data.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : null;
  }

  if (input.isApproved !== undefined) {
    data.isApproved = input.isApproved;
    if (input.isApproved && input.approvedAt === undefined && !existing.approvedAt) {
      data.approvedAt = new Date();
    }
    if (!input.isApproved && input.approvedAt === undefined) {
      data.approvedAt = null;
    }
  }
  if (input.approvedAt !== undefined) {
    data.approvedAt = input.approvedAt ? new Date(input.approvedAt) : null;
  }

  const row = await prisma.deliverable.update({ where: { id }, data });

  const approvalFlipping =
    input.isApproved !== undefined && input.isApproved !== existing.isApproved;
  await recordAudit({
    req,
    action: approvalFlipping
      ? input.isApproved
        ? 'deliverable.approved'
        : 'deliverable.unapproved'
      : 'deliverable.updated',
    entityTable: 'deliverables',
    entityId: row.id,
    entityLabel: row.title,
    before: existing,
    after: row,
    metadata: { patch: input },
  });

  ok(res, row);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.deliverable.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('deliverable');

  await prisma.deliverable.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'deliverable.deleted',
    entityTable: 'deliverables',
    entityId: id,
    entityLabel: existing.title,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
