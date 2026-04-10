// GET    /api/tickets/:id  — fetch one ticket
// PATCH  /api/tickets/:id  — partial update. Auto-stamps resolvedAt on status=resolved
//                            and closedAt on status=closed (unless caller sets them).
// DELETE /api/tickets/:id  — soft delete (sets deletedAt)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, ok, notFound, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import { updateTicketSchema } from '../../src/schemas/ticket.js';

function getId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('ticket');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const ticket = await prisma.ticket.findFirst({ where: { id, deletedAt: null } });
  if (!ticket) notFound('ticket');
  ok(res, ticket);
}

async function patch(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const input = parseBody(updateTicketSchema, req.body);

  const existing = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('ticket');

  // If changing nursery, validate.
  if (input.nurseryId && input.nurseryId !== existing.nurseryId) {
    const n = await prisma.nursery.findFirst({
      where: { id: input.nurseryId, deletedAt: null },
      select: { id: true },
    });
    if (!n) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');
  }

  // If attaching a project, validate it exists and belongs to the (new or existing) nursery.
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

  const data: Prisma.TicketUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.type !== undefined) data.type = input.type;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
  if (input.reportedById !== undefined) data.reportedById = input.reportedById;
  if (input.reportedEmail !== undefined) data.reportedEmail = input.reportedEmail;
  if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.resolutionNote !== undefined) data.resolutionNote = input.resolutionNote;
  if (input.nurseryId !== undefined) data.nurseryId = input.nurseryId;
  if (input.projectId !== undefined) data.projectId = input.projectId;

  if (input.status !== undefined) {
    data.status = input.status;
    // Auto-stamp resolved/closed timestamps on transition.
    if (
      input.status === 'resolved' &&
      input.resolvedAt === undefined &&
      !existing.resolvedAt
    ) {
      data.resolvedAt = new Date();
    }
    if (input.status === 'closed' && input.closedAt === undefined && !existing.closedAt) {
      data.closedAt = new Date();
    }
  }
  if (input.resolvedAt !== undefined) {
    data.resolvedAt = input.resolvedAt ? new Date(input.resolvedAt) : null;
  }
  if (input.closedAt !== undefined) {
    data.closedAt = input.closedAt ? new Date(input.closedAt) : null;
  }

  const ticket = await prisma.ticket.update({ where: { id }, data });

  const statusChanging = input.status !== undefined && input.status !== existing.status;
  await recordAudit({
    req,
    action: statusChanging ? 'ticket.status_changed' : 'ticket.updated',
    entityTable: 'tickets',
    entityId: ticket.id,
    entityLabel: ticket.title,
    before: existing,
    after: ticket,
    metadata: {
      patch: input,
      ...(statusChanging
        ? { statusFrom: existing.status, statusTo: input.status }
        : {}),
    },
  });

  ok(res, ticket);
}

async function remove(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = getId(req);
  const existing = await prisma.ticket.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) notFound('ticket');

  await prisma.ticket.update({ where: { id }, data: { deletedAt: new Date() } });

  await recordAudit({
    req,
    action: 'ticket.deleted',
    entityTable: 'tickets',
    entityId: id,
    entityLabel: existing.title,
    before: existing,
  });

  ok(res, { id, deleted: true });
}

export default route({ GET: get, PATCH: patch, DELETE: remove });
