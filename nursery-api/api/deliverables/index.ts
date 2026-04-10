// GET  /api/deliverables — list (projectId, type, isApproved, search, pagination)
// POST /api/deliverables — create. Validates parent project exists.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createDeliverableSchema,
  listDeliverablesQuerySchema,
} from '../../src/schemas/content.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { projectId, type, isApproved, search, limit, offset } = parseQuery(
    listDeliverablesQuerySchema,
    req.query,
  );

  const where: Prisma.DeliverableWhereInput = { deletedAt: null };
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;
  if (isApproved !== undefined) where.isApproved = isApproved;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { titleAr: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.deliverable.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.deliverable.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createDeliverableSchema, req.body);

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new HttpError(400, 'invalid_project', 'projectId does not exist');

  // If caller sets isApproved=true without approvedAt, auto-stamp it.
  const now = new Date();
  const approvedAt =
    input.approvedAt !== undefined
      ? input.approvedAt
        ? new Date(input.approvedAt)
        : null
      : input.isApproved
        ? now
        : null;

  const deliverable = await prisma.deliverable.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      titleAr: input.titleAr,
      description: input.description,
      type: input.type,
      fileUrl: input.fileUrl,
      previewUrl: input.previewUrl,
      version: input.version ?? 1,
      isApproved: input.isApproved ?? false,
      approvedAt,
      approvedById: input.approvedById,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
    },
  });

  await recordAudit({
    req,
    action: 'deliverable.created',
    entityTable: 'deliverables',
    entityId: deliverable.id,
    entityLabel: deliverable.title,
    after: deliverable,
  });

  ok(res, deliverable, 201);
}

export default route({ GET: list, POST: create });
