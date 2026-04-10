// GET  /api/tickets — list tickets (nurseryId, projectId, status, priority, type, assignedToId, search, pagination)
// POST /api/tickets — create ticket. Validates parent nursery (+ optional project) exists.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createTicketSchema,
  listTicketsQuerySchema,
} from '../../src/schemas/ticket.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { nurseryId, projectId, status, priority, type, assignedToId, search, limit, offset } =
    parseQuery(listTicketsQuerySchema, req.query);

  const where: Prisma.TicketWhereInput = { deletedAt: null };
  if (nurseryId) where.nurseryId = nurseryId;
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (type) where.type = type;
  if (assignedToId) where.assignedToId = assignedToId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.ticket.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createTicketSchema, req.body);

  const nursery = await prisma.nursery.findFirst({
    where: { id: input.nurseryId, deletedAt: null },
    select: { id: true },
  });
  if (!nursery) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, nurseryId: true },
    });
    if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');
    if (project.nurseryId !== input.nurseryId) {
      throw new HttpError(
        400,
        'project_nursery_mismatch',
        'project does not belong to the given nursery',
      );
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      nurseryId: input.nurseryId,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'open',
      assignedToId: input.assignedToId,
      reportedById: input.reportedById,
      reportedEmail: input.reportedEmail,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      tags: input.tags ?? [],
    },
  });

  await recordAudit({
    req,
    action: 'ticket.created',
    entityTable: 'tickets',
    entityId: ticket.id,
    entityLabel: ticket.title,
    after: ticket,
  });

  ok(res, ticket, 201);
}

export default route({ GET: list, POST: create });
