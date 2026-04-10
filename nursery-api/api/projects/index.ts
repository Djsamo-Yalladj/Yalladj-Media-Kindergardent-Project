// GET  /api/projects — list projects (nurseryId, stage, assignedToId, packageType, search, pagination)
// POST /api/projects — create project. Also opens initial ProjectStageRecord.
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { route, parseBody, parseQuery, ok, HttpError } from '../../src/lib/http.js';
import { recordAudit } from '../../src/lib/audit.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
} from '../../src/schemas/project.js';

async function list(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { nurseryId, stage, assignedToId, packageType, search, limit, offset } = parseQuery(
    listProjectsQuerySchema,
    req.query,
  );

  const where: Prisma.ProjectWhereInput = { deletedAt: null };
  if (nurseryId) where.nurseryId = nurseryId;
  if (stage) where.stage = stage;
  if (assignedToId) where.assignedToId = assignedToId;
  if (packageType) where.packageType = packageType;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.project.count({ where }),
  ]);

  ok(res, { rows, total, limit, offset });
}

async function create(req: VercelRequest, res: VercelResponse): Promise<void> {
  const input = parseBody(createProjectSchema, req.body);

  // Validate parent nursery exists and is live.
  const nursery = await prisma.nursery.findFirst({
    where: { id: input.nurseryId, deletedAt: null },
    select: { id: true },
  });
  if (!nursery) throw new HttpError(400, 'invalid_nursery', 'nurseryId does not exist');

  // Slug uniqueness pre-check.
  const clash = await prisma.project.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (clash) throw new HttpError(409, 'slug_taken', `slug "${input.slug}" is already in use`);

  const initialStage = input.stage ?? 'lead';

  // HTTP adapter can't do nested writes (they implicitly wrap in a transaction).
  // So create the project, then open its initial stage record as a second call.
  const project = await prisma.project.create({
    data: {
      nurseryId: input.nurseryId,
      name: input.name,
      slug: input.slug,
      description: (input.description ?? undefined) as Prisma.InputJsonValue | undefined,
      packageType: input.packageType,
      stage: initialStage,
      contractValue:
        input.contractValue != null ? new Prisma.Decimal(input.contractValue) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      targetLaunchDate: input.targetLaunchDate ? new Date(input.targetLaunchDate) : null,
      assignedToId: input.assignedToId,
      progressPercent: input.progressPercent ?? 0,
      liveUrl: input.liveUrl,
      repoUrl: input.repoUrl,
      notes: input.notes,
    },
  });
  await prisma.projectStageRecord.create({
    data: { projectId: project.id, stage: initialStage },
  });

  await recordAudit({
    req,
    action: 'project.created',
    entityTable: 'projects',
    entityId: project.id,
    entityLabel: project.name,
    after: project,
    metadata: { initialStage },
  });

  ok(res, project, 201);
}

export default route({ GET: list, POST: create });
