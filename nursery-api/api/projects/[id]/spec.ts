// GET /api/projects/:id/spec — fetch the ProjectSpec (may be null)
// PUT /api/projects/:id/spec — upsert ProjectSpec (one-to-one with Project)
// TODO(phase-b): add auth (req.user → audit actor).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../src/lib/prisma.js';
import { route, parseBody, ok, notFound } from '../../../src/lib/http.js';
import { recordAudit } from '../../../src/lib/audit.js';
import { upsertProjectSpecSchema } from '../../../src/schemas/project.js';

function getProjectId(req: VercelRequest): string {
  const raw = req.query.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== 'string') notFound('project');
  return id;
}

async function get(req: VercelRequest, res: VercelResponse): Promise<void> {
  const projectId = getProjectId(req);
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) notFound('project');

  const spec = await prisma.projectSpec.findFirst({
    where: { projectId, deletedAt: null },
  });
  ok(res, spec); // null if never created
}

// Using PUT (not PATCH) because this is upsert semantics.
async function put(req: VercelRequest, res: VercelResponse): Promise<void> {
  const projectId = getProjectId(req);
  const input = parseBody(upsertProjectSpecSchema, req.body);

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!project) notFound('project');

  const existing = await prisma.projectSpec.findFirst({
    where: { projectId, deletedAt: null },
  });

  // Translate `approved: true` into approvedAt timestamp.
  const approvedAt =
    input.approved === true ? new Date() : input.approved === false ? null : undefined;

  const data = {
    brandColors: input.brandColors as Prisma.InputJsonValue | undefined,
    brandFonts: input.brandFonts as Prisma.InputJsonValue | undefined,
    logoUrl: input.logoUrl,
    pages: input.pages as Prisma.InputJsonValue | undefined,
    features: input.features as Prisma.InputJsonValue | undefined,
    integrations: input.integrations as Prisma.InputJsonValue | undefined,
    contentPlan: input.contentPlan as Prisma.InputJsonValue | undefined,
    targetAudience: input.targetAudience as Prisma.InputJsonValue | undefined,
    referenceSites: input.referenceSites,
    briefEn: input.briefEn,
    briefAr: input.briefAr,
    claudeCodeBrief: input.claudeCodeBrief,
    claudeCodeStatus: input.claudeCodeStatus,
    claudeCodeLog: input.claudeCodeLog as Prisma.InputJsonValue | undefined,
    ...(approvedAt !== undefined ? { approvedAt } : {}),
  };

  const spec = await prisma.projectSpec.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });

  await recordAudit({
    req,
    action: existing ? 'project_spec.updated' : 'project_spec.created',
    entityTable: 'project_specs',
    entityId: spec.id,
    entityLabel: project.name,
    before: existing ?? null,
    after: spec,
    metadata: { projectId },
  });

  ok(res, spec);
}

export default route({ GET: get, PUT: put });
