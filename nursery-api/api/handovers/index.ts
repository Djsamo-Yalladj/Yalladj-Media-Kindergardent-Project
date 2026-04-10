// GET  /api/handovers — list (nurseryId, projectId, type, search, pagination)
// POST /api/handovers — create. Validates nursery + optional project exist.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createHandoverSchema,
  listHandoversQuerySchema,
} from '../../src/schemas/ticket.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { nurseryId, projectId, type, search, limit, offset } = parseQuery(
    listHandoversQuerySchema,
    req.query,
  );

  const where: Prisma.HandoverWhereInput = { deletedAt: null };
  if (nurseryId) where.nurseryId = nurseryId;
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.handover.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.handover.count({ where }),
  ]);

  // BigInt sizeBytes — JSON.stringify can't serialize. Coerce to string | null.
  const safeRows = rows.map((h) => ({
    ...h,
    sizeBytes: h.sizeBytes == null ? null : h.sizeBytes.toString(),
  }));

  ok(res, { rows: safeRows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createHandoverSchema, req.body);

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

  const handover = await prisma.handover.create({
    data: {
      nurseryId: input.nurseryId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      description: input.description,
      archiveUrl: input.archiveUrl,
      manifest: (input.manifest ?? undefined) as Prisma.InputJsonValue | undefined,
      sizeBytes: input.sizeBytes != null ? BigInt(input.sizeBytes) : null,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
      deliveredToEmail: input.deliveredToEmail,
    },
  });

  await recordAudit({
    req,
    action: 'handover.created',
    entityTable: 'handovers',
    entityId: handover.id,
    entityLabel: handover.title,
    after: handover,
  });

  ok(
    res,
    {
      ...handover,
      sizeBytes: handover.sizeBytes == null ? null : handover.sizeBytes.toString(),
    },
    201,
  );
}

export default route({ GET: list, POST: create });
